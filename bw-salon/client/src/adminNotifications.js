import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { API_BASE_URL } from "./shared.js";

const ITEMS_KEY = "bwa-notifications";
const SEEN_KEY = "bwa-seen";
const PENDING_ACKS_KEY = "bwa-pending-notification-acks";
const SOUND_KEY = "bwa-sound-enabled";
const VOLUME_KEY = "bwa-sound-volume";
const SOUND_PRESET_KEY = "bwa-sound-preset";
const SOUND_PRESETS = ["classic", "gentle", "double", "digital"];
const SOUND_TIMEOUT_MS = 5 * 60 * 1000;

const stored = (key, fallback) => {
  try {
    const value = localStorage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
};

const bookingDate = value =>
  new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export default function useAdminNotifications(token) {
  const [notifications, setNotifications] = useState(() => stored(ITEMS_KEY, []));
  const [popupQueue, setPopupQueue] = useState([]);
  const [soundEnabled, setSoundEnabledState] = useState(
    () => stored(SOUND_KEY, true) !== false,
  );
  const [volume, setVolumeState] = useState(() => {
    const saved = Number(stored(VOLUME_KEY, 0.65));
    return Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 0.65;
  });
  const [soundPreset, setSoundPresetState] = useState(() => {
    const saved = stored(SOUND_PRESET_KEY, "classic");
    return SOUND_PRESETS.includes(saved) ? saved : "classic";
  });
  const [syncError, setSyncError] = useState("");
  const [soundError, setSoundError] = useState("");
  const [permission, setPermission] = useState(
    () => ("Notification" in window ? Notification.permission : "unsupported"),
  );
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState("");
  const [ringing, setRinging] = useState(false);
  const itemsRef = useRef(notifications);
  const seenRef = useRef(new Set(stored(SEEN_KEY, [])));
  const acknowledgedRef = useRef(new Set());
  const queuedIdsRef = useRef(new Set());
  const popupQueueRef = useRef([]);
  const pendingAcksRef = useRef(new Set(stored(PENDING_ACKS_KEY, [])));
  const ackInFlightRef = useRef(new Set());
  const audioContextRef = useRef(null);
  const masterGainRef = useRef(null);
  const activeSourcesRef = useRef(new Set());
  const pendingSoundsRef = useRef([]);
  const pendingSoundIdsRef = useRef(new Set());
  const soundPlaybackRunningRef = useRef(false);
  const activeSoundIdRef = useRef(null);
  const soundDeadlinesRef = useRef(new Map());
  const soundRepeatTimerRef = useRef(null);
  const soundPlaybackGenerationRef = useRef(0);
  const socketRef = useRef(null);
  const ringTimerRef = useRef(null);
  const soundEnabledRef = useRef(soundEnabled);
  const volumeRef = useRef(volume);
  const soundPresetRef = useRef(soundPreset);

  useEffect(() => {
    popupQueueRef.current = popupQueue;
  }, [popupQueue]);

  useEffect(() => {
    const nextDeadline = notifications
      .filter(item => !item.read)
      .map(item => new Date(item.createdAt).getTime() + SOUND_TIMEOUT_MS)
      .filter(deadline => Number.isFinite(deadline) && deadline > Date.now())
      .sort((first, second) => first - second)[0];
    if (!nextDeadline) return undefined;
    const timer = window.setTimeout(
      () => setNotifications(current => [...current]),
      Math.max(0, nextDeadline - Date.now()),
    );
    return () => window.clearTimeout(timer);
  }, [notifications]);

  const prepareAudioContext = useCallback(async () => {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is not supported by this browser.");
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContextClass();
        masterGainRef.current = audioContextRef.current.createGain();
        masterGainRef.current.gain.value = volumeRef.current;
        masterGainRef.current.connect(audioContextRef.current.destination);
      }
      await audioContextRef.current.resume();
      if (audioContextRef.current.state !== "running") {
        throw new Error("Audio is blocked by the browser. Turn sound on again to enable it.");
      }
      setSoundError("");
      return true;
    } catch (error) {
      setSoundError(error.message || "Could not enable notification sound.");
      return false;
    }
  }, []);

  const persistItems = useCallback(next => {
    itemsRef.current = next;
    setNotifications(next);
    localStorage.setItem(ITEMS_KEY, JSON.stringify(next));
  }, []);

  const stopAlertSound = useCallback(() => {
    window.clearTimeout(soundRepeatTimerRef.current);
    soundRepeatTimerRef.current = null;
    pendingSoundsRef.current = [];
    pendingSoundIdsRef.current.clear();
    activeSoundIdRef.current = null;
    soundDeadlinesRef.current.clear();
    soundPlaybackGenerationRef.current += 1;
    soundPlaybackRunningRef.current = false;
    for (const source of activeSourcesRef.current) {
      try {
        source.stop();
      } catch {
        activeSourcesRef.current.delete(source);
      }
    }
  }, []);

  const playSelectedSound = useCallback(() => {
    const context = audioContextRef.current;
    const masterGain = masterGainRef.current;
    if (!context || context.state !== "running" || !masterGain) return 0;

    const patterns = {
      classic: [[659.25, 0, 0.22, "sine"], [880, 0.25, 0.28, "sine"], [1174.66, 0.58, 0.42, "sine"]],
      gentle: [[523.25, 0, 0.24, "sine"], [659.25, 0.28, 0.3, "sine"]],
      double: [[880, 0, 0.17, "sine"], [659.25, 0.24, 0.17, "sine"], [880, 0.48, 0.28, "sine"]],
      digital: [[660, 0, 0.12, "square"], [880, 0.17, 0.12, "square"], [660, 0.34, 0.12, "square"]],
    };
    const notes = patterns[soundPresetRef.current] || patterns.gentle;
    const now = context.currentTime;
    let duration = 0;
    notes.forEach(([frequency, offset, noteLength, waveform]) => {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      const startAt = now + offset;
      const endAt = startAt + noteLength;
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      envelope.gain.setValueAtTime(0.0001, startAt);
      envelope.gain.linearRampToValueAtTime(0.22, startAt + 0.02);
      envelope.gain.setValueAtTime(0.22, endAt - 0.04);
      envelope.gain.linearRampToValueAtTime(0.0001, endAt);
      oscillator.connect(envelope);
      envelope.connect(masterGain);
      activeSourcesRef.current.add(oscillator);
      oscillator.onended = () => activeSourcesRef.current.delete(oscillator);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.01);
      duration = Math.max(duration, offset + noteLength);
    });
    return duration;
  }, []);

  const scheduleAlertSound = useCallback(() => {
    if (
      !soundEnabledRef.current ||
      soundPlaybackRunningRef.current ||
      soundRepeatTimerRef.current
    ) return;
    if (!activeSoundIdRef.current) {
      while (pendingSoundsRef.current.length) {
        const candidate = pendingSoundsRef.current.shift();
        if ((soundDeadlinesRef.current.get(candidate) || 0) > Date.now()) {
          activeSoundIdRef.current = candidate;
          break;
        }
        pendingSoundIdsRef.current.delete(candidate);
        soundDeadlinesRef.current.delete(candidate);
      }
    }
    if (!activeSoundIdRef.current) return;

    soundPlaybackRunningRef.current = true;
    const generation = soundPlaybackGenerationRef.current;
    void prepareAudioContext().then(async ready => {
      if (
        !ready ||
        !soundEnabledRef.current ||
        generation !== soundPlaybackGenerationRef.current ||
        !activeSoundIdRef.current
      ) return;
      const duration = playSelectedSound();
      if (!duration) return;
      soundRepeatTimerRef.current = window.setTimeout(() => {
        soundRepeatTimerRef.current = null;
        const id = activeSoundIdRef.current;
        if (!id) return;
        const remaining = (soundDeadlinesRef.current.get(id) || 0) - Date.now();
        if (remaining <= 0) {
          stopAlertForAppointmentRef.current(id);
        } else {
          pendingSoundsRef.current.push(id);
          activeSoundIdRef.current = null;
          scheduleSoundRef.current();
        }
      }, Math.min((duration + 1.5) * 1000, Math.max(0, (soundDeadlinesRef.current.get(activeSoundIdRef.current) || 0) - Date.now())));
    }).finally(() => {
      soundPlaybackRunningRef.current = false;
    });
  }, [playSelectedSound, prepareAudioContext]);
  const scheduleSoundRef = useRef(scheduleAlertSound);
  scheduleSoundRef.current = scheduleAlertSound;

  const queueAlertSound = useCallback((id, createdAt) => {
    const key = String(id);
    if (
      !soundEnabledRef.current ||
      pendingSoundIdsRef.current.has(key) ||
      (soundDeadlinesRef.current.get(key) || 0) > 0
    ) return;
    const deadline = new Date(createdAt).getTime() + SOUND_TIMEOUT_MS;
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return;
    soundDeadlinesRef.current.set(key, deadline);
    pendingSoundIdsRef.current.add(key);
    pendingSoundsRef.current.push(key);
    scheduleSoundRef.current();
  }, []);

  const stopAlertForAppointment = useCallback(id => {
    const key = String(id);
    pendingSoundsRef.current = pendingSoundsRef.current.filter(item => item !== key);
    pendingSoundIdsRef.current.delete(key);
    soundDeadlinesRef.current.delete(key);
    if (activeSoundIdRef.current === key) {
      window.clearTimeout(soundRepeatTimerRef.current);
      soundRepeatTimerRef.current = null;
      activeSoundIdRef.current = null;
      soundPlaybackGenerationRef.current += 1;
      soundPlaybackRunningRef.current = false;
      for (const source of activeSourcesRef.current) {
        try {
          source.stop();
        } catch {
          activeSourcesRef.current.delete(source);
        }
      }
    }
    scheduleSoundRef.current();
  }, []);

  const stopAlertForAppointmentRef = useRef(stopAlertForAppointment);
  stopAlertForAppointmentRef.current = stopAlertForAppointment;

  const showDesktopNotification = useCallback(item => {
    if (
      document.hidden &&
      "Notification" in window &&
      Notification.permission === "granted"
    ) {
      const notice = new Notification("New appointment received", {
        body: `${item.customerName} · ${item.service} · ${bookingDate(item.date)} at ${item.time}`,
        tag: item.appointmentId,
      });
      notice.onclick = () => {
        window.focus();
        window.location.assign("/admin?appointmentId=" + encodeURIComponent(item.appointmentId));
        notice.close();
      };
    }
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      if (soundEnabledRef.current && audioContextRef.current?.state !== "running") {
        void prepareAudioContext().then(ready => {
          if (ready) scheduleSoundRef.current();
        });
      }
    };
    document.addEventListener("pointerdown", unlockAudio);
    document.addEventListener("keydown", unlockAudio);
    return () => {
      document.removeEventListener("pointerdown", unlockAudio);
      document.removeEventListener("keydown", unlockAudio);
    };
  }, [prepareAudioContext]);

  const sendPendingAcknowledgements = useCallback(() => {
    const socket = socketRef.current;
    if (!socket?.connected) return;
    for (const id of pendingAcksRef.current) {
      if (ackInFlightRef.current.has(id)) continue;
      ackInFlightRef.current.add(id);
      socket.timeout(5000).emit("notifications:ack", id, (timeoutError, result) => {
        ackInFlightRef.current.delete(id);
        if (!timeoutError && !result?.error) {
          pendingAcksRef.current.delete(id);
          acknowledgedRef.current.add(id);
          queuedIdsRef.current.delete(id);
          localStorage.setItem(PENDING_ACKS_KEY, JSON.stringify([...pendingAcksRef.current]));
          if (pendingAcksRef.current.size === 0) setSyncError("");
          return;
        }
        setSyncError(result?.error || "The API did not acknowledge this action. Check that the latest server is running; retrying.");
        if (socket.connected) {
          window.setTimeout(() => sendPendingAcknowledgementsRef.current(), 2000);
        }
      });
    }
  }, []);
  const sendPendingAcknowledgementsRef = useRef(sendPendingAcknowledgements);
  sendPendingAcknowledgementsRef.current = sendPendingAcknowledgements;

  const acknowledgeNotification = useCallback(id => {
    const key = String(id);
    pendingAcksRef.current.add(key);
    queuedIdsRef.current.delete(key);
    localStorage.setItem(PENDING_ACKS_KEY, JSON.stringify([...pendingAcksRef.current]));
    sendPendingAcknowledgements();
  }, [sendPendingAcknowledgements]);

  const removePopup = useCallback(id => {
    const key = String(id);
    const next = popupQueueRef.current.filter(item => String(item._id) !== key);
    popupQueueRef.current = next;
    setPopupQueue(next);
  }, []);

  const receive = useCallback((item, { isNew = false, showPopup = false } = {}) => {
    if (!item?._id) return;
    const id = String(item._id);
    if (pendingAcksRef.current.has(id) || acknowledgedRef.current.has(id)) return;
    const firstReceipt = !seenRef.current.has(id);
    if (firstReceipt) {
      seenRef.current.add(id);
      const seen = [...seenRef.current].slice(-1000);
      seenRef.current = new Set(seen);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }

    const existing = itemsRef.current.find(entry => String(entry._id) === id);
    const nextNotifications = [{
      ...item,
      read: existing ? existing.read : false,
    }, ...itemsRef.current]
      .filter((entry, index, list) => list.findIndex(other => other._id === entry._id) === index)
      .slice(0, 50);
    persistItems(nextNotifications);

    if (
      showPopup &&
      item.status === "pending" &&
      !acknowledgedRef.current.has(id) &&
      !queuedIdsRef.current.has(id)
    ) {
      queuedIdsRef.current.add(id);
      const nextQueue = [...popupQueueRef.current, item].sort((first, second) => {
        const byDate = new Date(first.createdAt) - new Date(second.createdAt);
        return byDate || String(first._id).localeCompare(String(second._id));
      });
      popupQueueRef.current = nextQueue;
      setPopupQueue(nextQueue);
    }

    if (showPopup && item.status === "pending") {
      queueAlertSound(item.appointmentId || item._id, item.createdAt);
    }

    if (isNew && firstReceipt) {
      setRinging(true);
      window.clearTimeout(ringTimerRef.current);
      ringTimerRef.current = window.setTimeout(() => setRinging(false), 1400);
      showDesktopNotification(item);
    }
  }, [persistItems, queueAlertSound, showDesktopNotification]);

  useEffect(() => {
    if (!token) return undefined;
    const socket = API_BASE_URL
      ? io(API_BASE_URL, { auth: { token }, reconnection: true })
      : io({ auth: { token }, reconnection: true });
    socketRef.current = socket;

    socket.on("connect", () => {
      ackInFlightRef.current.clear();
      setConnected(true);
      setConnectionError("");
      sendPendingAcknowledgements();
      scheduleSoundRef.current();
      socket.emit("notifications:sync", null);
    });
    socket.on("disconnect", () => {
      ackInFlightRef.current.clear();
      setConnected(false);
    });
    socket.on("appointment:new", item => {
      receive(item, { isNew: true, showPopup: true });
      window.dispatchEvent(new Event("salon:appointments-changed"));
    });
    socket.on("appointment:updated", item => {
      persistItems(itemsRef.current.map(entry =>
        entry._id === item._id
          ? { ...entry, ...item, read: item.status === "pending" ? entry.read : true }
          : entry,
      ));
      if (item.status !== "pending") {
        removePopup(item._id);
        stopAlertForAppointment(item.appointmentId || item._id);
        acknowledgeNotification(item._id);
      }
      window.dispatchEvent(new Event("salon:appointments-changed"));
    });
    socket.on("notifications:backlog", payload => {
      setSyncError("");
      for (const item of payload.notifications || []) {
        receive(item, { showPopup: true });
      }
      if (payload.hasMore && payload.cursor) {
        socket.emit("notifications:sync", payload.cursor);
      }
    });
    socket.on("notifications:error", error => setSyncError(error.message));
    socket.on("connect_error", error => {
      setConnected(false);
      setConnectionError(error.message === "Unauthorized"
        ? "Admin session expired. Please sign in again."
        : "Cannot reach the notification server. Restart the API and Vite dev server.");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      window.clearTimeout(ringTimerRef.current);
      stopAlertSound();
      setConnected(false);
    };
  }, [acknowledgeNotification, persistItems, receive, removePopup, sendPendingAcknowledgements, stopAlertForAppointment, stopAlertSound, token]);

  const setSoundEnabled = useCallback(async value => {
    soundEnabledRef.current = value;
    setSoundEnabledState(value);
    localStorage.setItem(SOUND_KEY, JSON.stringify(value));
    setSoundError("");
    if (!value) {
      stopAlertSound();
      return;
    }

    try {
      const ready = await prepareAudioContext();
      if (ready) {
        const duration = playSelectedSound();
        window.setTimeout(
          () => scheduleSoundRef.current(),
          duration ? duration * 1000 + 100 : 0,
        );
      }
      if ("Notification" in window && Notification.permission === "default") {
        try {
          setPermission(await Notification.requestPermission());
        } catch {
          setPermission("denied");
        }
      }
    } catch (error) {
      setSoundError(error.message || "Could not enable notification sound.");
    }
  }, [playSelectedSound, prepareAudioContext, stopAlertSound]);

  const setVolume = useCallback(value => {
    const next = Math.min(1, Math.max(0, Number(value)));
    volumeRef.current = next;
    setVolumeState(next);
    localStorage.setItem(VOLUME_KEY, JSON.stringify(next));
    if (masterGainRef.current) {
      masterGainRef.current.gain.setTargetAtTime(
        next,
        audioContextRef.current.currentTime,
        0.03,
      );
    }
  }, []);

  const setSoundPreset = useCallback(preset => {
    if (!SOUND_PRESETS.includes(preset)) return;
    soundPresetRef.current = preset;
    setSoundPresetState(preset);
    localStorage.setItem(SOUND_PRESET_KEY, JSON.stringify(preset));
  }, []);

  const previewSound = useCallback(async () => {
    const ready = await prepareAudioContext();
    if (ready) playSelectedSound();
  }, [playSelectedSound, prepareAudioContext]);

  const updateAppointment = useCallback((id, status) => {
    persistItems(itemsRef.current.map(item =>
      item._id === String(id) ? { ...item, status, read: status === "pending" ? item.read : true } : item,
    ));
    if (status !== "pending") {
      removePopup(id);
      stopAlertForAppointment(id);
      acknowledgeNotification(id);
    }
  }, [acknowledgeNotification, persistItems, removePopup, stopAlertForAppointment]);

  const markRead = useCallback(id => {
    persistItems(itemsRef.current.map(item => item._id === id ? { ...item, read: true } : item));
  }, [persistItems]);

  const markAllRead = useCallback(() => {
    const ids = new Set([
      ...itemsRef.current.map(item => String(item._id)),
      ...popupQueueRef.current.map(item => String(item._id)),
    ]);
    for (const id of ids) {
      stopAlertForAppointment(id);
      acknowledgeNotification(id);
    }
    popupQueueRef.current = [];
    setPopupQueue([]);
    persistItems(itemsRef.current.map(item => ({ ...item, read: true })));
  }, [acknowledgeNotification, persistItems, stopAlertForAppointment]);

  const clearAll = useCallback(() => {
    const ids = new Set([
      ...itemsRef.current.map(item => String(item._id)),
      ...popupQueueRef.current.map(item => String(item._id)),
    ]);
    for (const id of ids) {
      acknowledgeNotification(id);
    }
    stopAlertSound();
    popupQueueRef.current = [];
    setPopupQueue([]);
    persistItems([]);
  }, [acknowledgeNotification, persistItems, stopAlertSound]);

  const overdueCount = notifications.filter(item =>
    !item.read &&
    Date.now() - new Date(item.createdAt).getTime() >= SOUND_TIMEOUT_MS,
  ).length;
  const dismissPopup = useCallback(() => {
    const current = popupQueueRef.current[0];
    if (!current) return;
    const next = popupQueueRef.current.slice(1);
    popupQueueRef.current = next;
    setPopupQueue(next);
    stopAlertForAppointment(current.appointmentId || current._id);
    acknowledgeNotification(current._id);
  }, [acknowledgeNotification, stopAlertForAppointment]);

  return {
    notifications,
    unreadCount: notifications.filter(item => !item.read).length,
    overdueCount,
    popup: popupQueue[0] || null,
    dismissPopup,
    soundEnabled,
    setSoundEnabled,
    soundPreset,
    setSoundPreset,
    previewSound,
    soundError,
    volume,
    setVolume,
    permission,
    connected,
    connectionError,
    ringing,
    syncError,
    markRead,
    markAllRead,
    clearAll,
    updateAppointment,
  };
}
