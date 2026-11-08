import 'dotenv/config';import express from 'express';import mongoose from 'mongoose';import cors from 'cors';import{createServer}from'http';import{Server}from'socket.io';
import jwt from 'jsonwebtoken';import multer from 'multer';import path from 'path';
import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { SUPPORTED_IMAGE_EXTENSIONS, SUPPORTED_IMAGE_MIME_TYPES } from './imageUploads.js';
import { createImageStore } from './imageStorage.js';
import { isAllowedClientOrigin } from './clientOrigins.js';
const LOCAL_MONGO_URI='mongodb://127.0.0.1:27017/bw-salon';
const configuredMongoUri=process.env.MONGO_URI?.trim();
const isProduction=process.env.NODE_ENV==='production';
const JWT_SECRET=process.env.JWT_SECRET?.trim();
const ADMIN_USER=process.env.ADMIN_USER?.trim();
const ADMIN_PASS=process.env.ADMIN_PASS;
const PORT=Number(process.env.PORT||5000);
const CLIENT_ORIGINS=(process.env.CLIENT_ORIGINS||'').split(',').map(origin=>origin.trim()).filter(Boolean);
const UPLOAD_DIR=path.resolve(process.env.UPLOAD_DIR||path.join(path.dirname(fileURLToPath(import.meta.url)),'uploads'));
const imageStore=createImageStore({cloudName:process.env.CLOUDINARY_CLOUD_NAME,apiKey:process.env.CLOUDINARY_API_KEY,apiSecret:process.env.CLOUDINARY_API_SECRET,uploadDir:UPLOAD_DIR,requireCloudinary:isProduction});
const missingCredentials=['JWT_SECRET','ADMIN_USER','ADMIN_PASS'].filter(name=>!process.env[name]?.trim());
if(missingCredentials.length)throw new Error(`Missing required environment variables: ${missingCredentials.join(', ')}`);
if(JWT_SECRET.length<32)throw new Error('JWT_SECRET must be at least 32 characters.');
if(ADMIN_USER.toLowerCase()==='admin'||ADMIN_PASS.length<16)throw new Error('Set a unique admin username and a strong password of at least 16 characters.');
if(isProduction){
 const missing=['MONGO_URI','CLIENT_ORIGINS'].filter(name=>!process.env[name]?.trim());
 if(missing.length)throw new Error(`Missing required production environment variables: ${missing.join(', ')}`);
 if(CLIENT_ORIGINS.some(origin=>{try{const parsed=new URL(origin);return parsed.origin!==origin||parsed.protocol!=='https:'}catch{return true}}))throw new Error('CLIENT_ORIGINS must contain HTTPS origins without paths.');
}
if(!Number.isInteger(PORT)||PORT<0||PORT>65535)throw new Error('PORT must be a valid TCP port.');
const Service=mongoose.model('Service',new mongoose.Schema({name:{type:String,required:true},description:String,price:{type:Number,required:true,min:0},duration:{type:Number,default:30,min:5},image:String,active:{type:Boolean,default:true}}));
const User=mongoose.model('Customer',new mongoose.Schema({customerId:{type:String,unique:true,index:true},name:{type:String,required:true,trim:true},username:{type:String,required:true,unique:true,lowercase:true,trim:true},passwordHash:{type:String,required:true}},{timestamps:true}));
const Counter=mongoose.model('Counter',new mongoose.Schema({_id:String,seq:{type:Number,default:0}}));
const Appt=mongoose.model('Appointment',new mongoose.Schema({bookingId:{type:String,unique:true,sparse:true},userId:{type:mongoose.Schema.Types.ObjectId,ref:'Customer',index:true},customerId:String,name:String,phone:String,serviceId:mongoose.Schema.Types.ObjectId,serviceName:String,price:Number,duration:Number,date:String,time:String,message:String,status:{type:String,default:'pending',enum:['pending','confirmed','rejected','completed','cancelled']},slotKey:{type:String,unique:true,sparse:true},notificationAcknowledged:{type:Boolean,default:true}},{timestamps:true}));
Appt.schema.index({notificationAcknowledged:1,createdAt:1,_id:1});
const Review=mongoose.model('Review',new mongoose.Schema({reviewId:{type:String,unique:true,index:true},customerId:{type:mongoose.Schema.Types.ObjectId,ref:'Customer',required:true,index:true},appointmentId:{type:mongoose.Schema.Types.ObjectId,ref:'Appointment',required:true,unique:true},rating:{type:Number,required:true,min:1,max:5,validate:Number.isInteger},comment:{type:String,default:'',maxlength:1200},approved:{type:Boolean,default:false},createdAt:{type:Date,default:Date.now},updatedAt:{type:Date,default:Date.now}},{versionKey:false}));
const Setting=mongoose.model('Setting',new mongoose.Schema({address:String,phone:String,whatsapp:String,mapQuery:String,socialLinks:{type:[{name:{type:String,trim:true,maxlength:40},url:{type:String,trim:true,maxlength:500}}],default:[]}}));
const GalleryImage=mongoose.model('GalleryImage',new mongoose.Schema({image:{type:String,required:true},createdAt:{type:Date,default:Date.now}}));
const Offer=mongoose.model('Offer',new mongoose.Schema({title:{type:String,required:true,trim:true,maxlength:100},description:{type:String,required:true,trim:true,maxlength:1000},offerType:{type:String,enum:['IMAGE','TEXT'],required:true},imageUrl:{type:String,default:''},discountType:{type:String,enum:['PERCENTAGE','FIXED_AMOUNT','SPECIAL_OFFER'],default:'SPECIAL_OFFER'},discountValue:{type:Number,default:null},validFrom:{type:String,default:''},validUntil:{type:String,default:''},termsAndConditions:{type:String,default:'',maxlength:1500},ctaText:{type:String,default:'',maxlength:40},ctaLink:{type:String,default:'',maxlength:500},isActive:{type:Boolean,default:true},isFeatured:{type:Boolean,default:false},displayFrequency:{type:String,enum:['SESSION','UNTIL_DISMISSED','AFTER_DAYS'],default:'SESSION'},repeatDays:{type:Number,default:7,min:1,max:365}},{timestamps:true}));
const DEF={address:"JP Road, 3/13, Varma Hospital Road, Near Adda Vantena, Beside Anna Canteen, Tammi Raju Nagar, Bhimavaram, Andhra Pradesh – 534202",phone:"098668 36511",whatsapp:"919866836511",mapQuery:"B&W The Mens Saloon, JP Road, Varma Hospital Road, Bhimavaram, Andhra Pradesh 534202",socialLinks:[]};
const cfg=async()=>(await Setting.findOne())||Setting.create(DEF);
const SLOTS=['10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00'];
const img=q=>`https://images.unsplash.com/${q}?auto=format&fit=crop&w=800&q=70`;
const SEED=[['Haircut',150,30,'photo-1585747860715-2ba37e788b70','Precision cut tailored to your face and style.'],['Beard Trimming',80,20,'photo-1621605815971-fbc98d665033','Clean shaping and trimming for a sharp beard.'],['Hair Styling',100,30,'photo-1622286342621-4bd786c2447c','Finish and style for any occasion.'],['Facial',300,45,'photo-1570172619644-dfd03ed5d881','Deep cleansing facial for fresh, glowing skin.'],['Hair Spa',500,60,'photo-1560066984-138dadb4c035','Nourishing spa treatment for healthy hair.'],['Hair Coloring',600,75,'photo-1562322140-8baeececf3df','Premium colour with long-lasting shine.'],['Shaving',60,20,'photo-1503951914875-452162b0f3f1','Classic hot-towel shave.']];
const app=express();const corsOrigin=(origin,callback)=>callback(null,isAllowedClientOrigin(origin,CLIENT_ORIGINS,isProduction));app.use((q,s,n)=>{s.setHeader('X-Content-Type-Options','nosniff');n()});app.use(cors({origin:corsOrigin}));app.use(express.json({limit:'1mb'}));app.use('/uploads',(q,s,n)=>{if(!SUPPORTED_IMAGE_EXTENSIONS.includes(path.extname(q.path).toLowerCase())&&path.extname(q.path).toLowerCase()!=='.jpeg')return s.sendStatus(404);s.setHeader('Content-Security-Policy',"sandbox; default-src 'none'");n()},express.static(UPLOAD_DIR));const httpServer=createServer(app);const io=new Server(httpServer,{cors:{origin:corsOrigin}});
const ADMIN_ROOM='admin-notifications';
io.use((socket,next)=>{try{const p=jwt.verify(socket.handshake.auth?.token||'',JWT_SECRET);if(p.role!=='admin')throw Error('Unauthorized');socket.data.admin=true;next()}catch{next(new Error('Unauthorized'))}});
const notificationFor=a=>({_id:String(a._id),appointmentId:String(a._id),bookingId:a.bookingId||`BWA${String(a._id).slice(-6).toUpperCase()}`,customerName:a.name,customerId:a.customerId,service:a.serviceName,date:a.date,time:a.time,amount:a.price,status:a.status,createdAt:a.createdAt});
app.get('/api/health',(q,s)=>{const connected=mongoose.connection.readyState===1;s.status(connected?200:503).json({status:connected?'ok':'degraded',database:connected?'connected':'disconnected'})});
app.get('/api/notifications/status',(q,s)=>s.json({acknowledgements:true}));
const sendPendingNotifications=async(socket,cursor)=>{let query={notificationAcknowledged:false,status:'pending'};if(cursor?.createdAt&&mongoose.Types.ObjectId.isValid(cursor.id)){const createdAt=new Date(cursor.createdAt);if(!Number.isNaN(createdAt.getTime()))query={$and:[query,{$or:[{createdAt:{$gt:createdAt}},{createdAt,_id:{$gt:new mongoose.Types.ObjectId(cursor.id)}}]}]}}const docs=await Appt.find(query).sort({createdAt:1,_id:1}).limit(100).lean();const last=docs[docs.length-1];socket.emit('notifications:backlog',{notifications:docs.map(notificationFor),hasMore:docs.length===100,cursor:last?{createdAt:last.createdAt,id:last._id}:cursor})};
io.on('connection',socket=>{if(!socket.data.admin)return;socket.join(ADMIN_ROOM);socket.on('notifications:sync',async cursor=>{try{await sendPendingNotifications(socket,cursor)}catch(error){console.error('Admin notification sync failed:',error);socket.emit('notifications:error',{message:'Unable to retrieve missed appointment notifications.'})}});socket.on('notifications:ack',async(id,reply=()=>{})=>{try{if(!mongoose.Types.ObjectId.isValid(id))return reply({error:'Invalid notification'});await Appt.updateOne({_id:id,notificationAcknowledged:false},{$set:{notificationAcknowledged:true}});reply({ok:true})}catch(error){console.error('Admin notification acknowledgement failed:',error);reply({error:'Unable to acknowledge notification'})}})});
const allowedUploadMimeType=(r,f,cb)=>{const valid=SUPPORTED_IMAGE_MIME_TYPES.includes(f.mimetype);cb(valid?null:Error('Use a JPG, PNG, WebP, or GIF image.'),valid)};
const uploadStorage=multer.memoryStorage();
const up=multer({storage:uploadStorage,limits:{fileSize:3e6},fileFilter:allowedUploadMimeType});
const galleryUpload=multer({storage:uploadStorage,limits:{fileSize:3e6},fileFilter:allowedUploadMimeType}).array('images',12);
const processImageFiles=(q,s,n,files,folder)=>{void (async()=>{try{for(const file of files)file.url=await imageStore.upload(file,folder);n()}catch(error){await Promise.all(files.filter(file=>file.url).map(file=>imageStore.remove(file.url).catch(cleanupError=>console.error('Unable to remove failed image upload:',cleanupError))));if(error.status===400)return s.status(400).json({error:error.message});console.error('Image upload processing failed:',error);return s.status(500).json({error:'Unable to process uploaded image.'})}})()};
const uploadFailure=(s,error,sizeMessage)=>{const tooLarge=error.code==='LIMIT_FILE_SIZE',invalidType=error.message.startsWith('Use a JPG');const status=tooLarge?413:error instanceof multer.MulterError||invalidType?400:500;if(status>=500)console.error('Image upload failed:',error);return s.status(status).json({error:tooLarge?sizeMessage:status>=500?'Unable to upload image.':error.message})};
const handleServiceUpload=(q,s,n)=>up.single('image')(q,s,error=>{if(error)return uploadFailure(s,error,'Images must be 3 MB or smaller.');if(!q.file)return n();processImageFiles(q,s,n,[q.file],'services')});
const handleGalleryUpload=(q,s,n)=>galleryUpload(q,s,error=>{if(error)return uploadFailure(s,error,'Images must be 3 MB or smaller.');if(!q.files?.length)return s.status(400).json({error:'Choose at least one valid image to upload.'});processImageFiles(q,s,n,q.files,'gallery')});
const offerExtensions={'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp'};
const offerUpload=multer({storage:uploadStorage,limits:{fileSize:5*1024*1024},fileFilter:(r,f,cb)=>{const valid=Object.hasOwn(offerExtensions,f.mimetype);cb(valid?null:Error('Use a JPG, PNG, or WebP offer image.'),valid)}}).single('image');
const handleOfferUpload=(q,s,n)=>offerUpload(q,s,error=>{if(error)return uploadFailure(s,error,'Offer images must be 5 MB or smaller.');if(!q.file)return n();processImageFiles(q,s,n,[q.file],'offers')});
const tokenAuth=(role)=> (q,s,n)=>{try{const token=(q.headers.authorization||'').replace(/^Bearer\s+/,'');const p=jwt.verify(token,JWT_SECRET);if(role&&p.role!==role)throw Error();q.user=p;n()}catch{s.status(401).json({error:'Unauthorized'})}};
const auth=tokenAuth('admin'),customerAuth=tokenAuth('customer');
const publicUser=u=>({_id:u._id,customerId:u.customerId,name:u.name,username:u.username});
const wrap=f=>(q,s)=>Promise.resolve().then(()=>f(q,s)).catch(error=>{const status=error.code===11000?409:error.status||(['ValidationError','CastError','StrictModeError'].includes(error.name)||error.name==='Error'?400:500);if(status>=500)console.error('API request failed:',error);s.status(status).json({error:status>=500?'Internal server error':error.code===11000?'That time slot was just taken. Please pick another.':error.message})});
const offerDateIsValid=value=>{if(!value)return true;if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T00:00:00.000Z`);return!Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value};
const offerBoolean=(value,name,fallback)=>{if(value===undefined)return fallback;if(value===true||value==='true')return true;if(value===false||value==='false')return false;throw Error(`${name} must be true or false`);};
const offerPayload=(body,existing,file)=>{
 const title=String(body.title||'').trim(),description=String(body.description||'').trim(),offerType=String(body.offerType||'TEXT'),discountType=String(body.discountType||'SPECIAL_OFFER'),validFrom=String(body.validFrom||''),validUntil=String(body.validUntil||''),ctaText=String(body.ctaText||'').trim(),ctaLink=String(body.ctaLink||'').trim(),displayFrequency=String(body.displayFrequency||'SESSION');
 if(!title||title.length>100)throw Error('Offer title is required and must be 100 characters or fewer');
 if(!description||description.length>1000)throw Error('Offer description is required and must be 1000 characters or fewer');
 if(!['IMAGE','TEXT'].includes(offerType))throw Error('Choose a valid offer type');
 if(!['PERCENTAGE','FIXED_AMOUNT','SPECIAL_OFFER'].includes(discountType))throw Error('Choose a valid discount type');
 if(!offerDateIsValid(validFrom)||!offerDateIsValid(validUntil))throw Error('Enter a valid offer date');
 if(validFrom&&validUntil&&validUntil<validFrom)throw Error('The end date must be on or after the start date');
 if(!['SESSION','UNTIL_DISMISSED','AFTER_DAYS'].includes(displayFrequency))throw Error('Choose a valid display frequency');
 const repeatDays=displayFrequency==='AFTER_DAYS'?Number(body.repeatDays||7):7;
 if(!Number.isInteger(repeatDays)||repeatDays<1||repeatDays>365)throw Error('Repeat interval must be from 1 to 365 days');
 if(ctaText.length>40||ctaLink.length>500)throw Error('CTA text or destination is too long');
 if(ctaLink){if(/[\u0000-\u001f\\]/.test(ctaLink))throw Error('CTA destination contains invalid characters');if(ctaLink.startsWith('//'))throw Error('CTA destination must be a site path or a secure HTTPS link');if(!ctaLink.startsWith('/')&&!ctaLink.startsWith('#')){let destination;try{destination=new URL(ctaLink)}catch{throw Error('Enter a valid CTA destination')}if(destination.protocol!=='https:'&&destination.protocol!=='http:')throw Error('CTA destination must use HTTP or HTTPS')}}
 const rawDiscount=String(body.discountValue??'').trim();
 let discountValue=null;
 if(rawDiscount){discountValue=Number(rawDiscount);if(!Number.isFinite(discountValue)||discountValue<0||(discountType==='PERCENTAGE'&&discountValue>100))throw Error('Enter a valid discount value')}
 if(discountType==='SPECIAL_OFFER')discountValue=null;
 const termsAndConditions=String(body.termsAndConditions||'').trim();
 if(termsAndConditions.length>1500)throw Error('Terms and conditions must be 1500 characters or fewer');
 if(file&&offerType!=='IMAGE')throw Error('Remove the image or choose an image-based offer');
 if(discountValue===0)throw Error('Discount value must be greater than zero');
 const imageUrl=offerType==='IMAGE'?(file?file.url:(existing?.offerType==='IMAGE'?existing.imageUrl:'')):'';
 if(offerType==='IMAGE'&&!imageUrl)throw Error('Upload an offer image before saving an image-based offer');
 return{title,description,offerType,imageUrl,discountType,discountValue,validFrom,validUntil,termsAndConditions,ctaText,ctaLink,isActive:offerBoolean(body.isActive,'Active status',true),isFeatured:offerBoolean(body.isFeatured,'Featured status',false),displayFrequency,repeatDays:displayFrequency==='AFTER_DAYS'?repeatDays:7};
};
const removeOfferUpload=async imageUrl=>{try{await imageStore.remove(imageUrl)}catch(error){console.error('Unable to remove uploaded image:',error)}};
const publicOffer=offer=>({_id:offer._id,title:offer.title,description:offer.description,offerType:offer.offerType,imageUrl:offer.imageUrl,discountType:offer.discountType,discountValue:offer.discountValue,validFrom:offer.validFrom,validUntil:offer.validUntil,termsAndConditions:offer.termsAndConditions,ctaText:offer.ctaText,ctaLink:offer.ctaLink,isFeatured:offer.isFeatured,displayFrequency:offer.displayFrequency,repeatDays:offer.repeatDays});
app.post('/api/login',(q,s)=>{const{username,password}=q.body;if(username===ADMIN_USER&&password===ADMIN_PASS)return s.json({token:jwt.sign({role:'admin'},JWT_SECRET,{expiresIn:'8h'})});s.status(401).json({error:'Invalid credentials'})});
app.post('/api/customers/register',wrap(async(q,s)=>{const{name,username,password,confirmPassword}=q.body;const clean=String(username||'').trim().toLowerCase();if(!name||name.trim().length<2)throw Error('Enter your full name');if(!/^[a-z0-9_.-]{3,24}$/.test(clean))throw Error('Username must be 3–24 letters, numbers, dots, underscores, or hyphens');if(!password||password.length<8)throw Error('Password must be at least 8 characters');if(password!==confirmPassword)throw Error('Passwords do not match');if(await User.exists({username:clean}))return s.status(409).json({error:'Username is already taken'});const c=await Counter.findOneAndUpdate({_id:'customerId'},{$inc:{seq:1}},{new:true,upsert:true});let u;try{u=await User.create({customerId:'B&W'+String(c.seq).padStart(6,'0'),name:name.trim(),username:clean,passwordHash:await bcrypt.hash(password,12)})}catch(error){if(error.code===11000&&(error.keyPattern?.username||error.keyValue?.username))return s.status(409).json({error:'Username is already taken'});throw error}s.status(201).json({token:jwt.sign({role:'customer',id:u.id},JWT_SECRET,{expiresIn:'30d'}),customer:publicUser(u)});}));
app.post('/api/customers/login',wrap(async(q,s)=>{const identity=String(q.body.username||'').trim();const u=await User.findOne({$or:[{username:identity.toLowerCase()},{customerId:identity.toUpperCase()}]});if(!u||!await bcrypt.compare(q.body.password||'',u.passwordHash))return s.status(401).json({error:'Invalid credentials'});s.json({token:jwt.sign({role:'customer',id:u.id},JWT_SECRET,{expiresIn:'30d'}),customer:publicUser(u)});}));
app.get('/api/customers/me',customerAuth,wrap(async(q,s)=>{const u=await User.findById(q.user.id);if(!u)return s.status(401).json({error:'Unauthorized'});s.json(publicUser(u));}));
app.patch('/api/customers/me',customerAuth,wrap(async(q,s)=>{const u=await User.findById(q.user.id);if(!u)return s.status(401).json({error:'Unauthorized'});if(q.body.name){if(q.body.name.trim().length<2)throw Error('Enter a valid name');u.name=q.body.name.trim();await Appt.updateMany({userId:u._id},{$set:{name:u.name}})}if(q.body.currentPassword||q.body.password){if(!await bcrypt.compare(q.body.currentPassword||'',u.passwordHash))return s.status(401).json({error:'Current password is incorrect'});if(!q.body.password||q.body.password.length<8)throw Error('New password must be at least 8 characters');u.passwordHash=await bcrypt.hash(q.body.password,12)}await u.save();s.json(publicUser(u));}));
app.get('/api/customers/me/appointments',customerAuth,wrap(async(q,s)=>{const appts=await Appt.find({userId:q.user.id}).sort({date:-1,time:-1});s.json({appointments:appts,total:appts.length,upcoming:appts.filter(a=>a.date>=new Date().toISOString().slice(0,10)&&['pending','confirmed'].includes(a.status)),completed:appts.filter(a=>a.status==='completed')});}));
app.get('/api/customers/me/reviews',customerAuth,wrap(async(q,s)=>s.json(await Review.find({customerId:q.user.id}).populate('appointmentId').sort({createdAt:-1}))));
app.post('/api/customers/me/appointments/:id/review',customerAuth,wrap(async(q,s)=>{const a=await Appt.findOne({_id:q.params.id,userId:q.user.id});if(!a)return s.status(404).json({error:'Appointment not found'});if(a.status!=='completed')return s.status(409).json({error:'Only completed appointments can be reviewed'});const rating=Number(q.body.rating);if(!Number.isInteger(rating)||rating<1||rating>5)throw Error('Choose a rating from 1 to 5');const comment=String(q.body.comment||'').trim();if(comment.length>1200)throw Error('Comment must be 1200 characters or fewer');const existing=await Review.findOne({appointmentId:a._id});if(existing){if(String(existing.customerId)!==String(q.user.id))return s.status(403).json({error:'Forbidden'});existing.rating=rating;existing.comment=comment;existing.approved=false;existing.updatedAt=new Date();await existing.save();return s.json(existing)}const customer=await User.findById(q.user.id);const r=await Review.create({reviewId:'BWR'+a._id.toString().slice(-9).toUpperCase(),customerId:customer._id,appointmentId:a._id,rating,comment});s.status(201).json(r)}));
app.get('/api/reviews',wrap(async(q,s)=>{const reviews=await Review.find({approved:true}).populate('customerId','name customerId').populate('appointmentId','serviceName date time').sort({createdAt:-1});const total=reviews.length;s.json({reviews,total,average:total?reviews.reduce((n,r)=>n+r.rating,0)/total:0})}));
app.get('/api/admin/customers',auth,wrap(async(q,s)=>{const search=String(q.query.search||'').trim();const filter=search?{$or:['customerId','name','username'].map(field=>({[field]:{$regex:search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),$options:'i'}}))}:{};const[totalUsers,customers]=await Promise.all([User.countDocuments(),User.find(filter).select('customerId name username createdAt').sort({createdAt:-1}).lean()]);const customerIds=customers.map(customer=>customer.customerId).filter(Boolean);const userIds=customers.map(customer=>customer._id);const summaries=customers.length?await Appt.aggregate([{$match:{$or:[{userId:{$in:userIds}},{customerId:{$in:customerIds}}]}},{$sort:{createdAt:-1,_id:-1}},{$group:{_id:{$ifNull:['$userId','$customerId']},appointmentCount:{$sum:1},completedCount:{$sum:{$cond:[{$eq:['$status','completed']},1,0]}},upcomingCount:{$sum:{$cond:[{$in:['$status',['pending','confirmed']]},1,0]}},recentAppointment:{$first:{bookingId:'$bookingId',serviceName:'$serviceName',date:'$date',time:'$time',status:'$status',createdAt:'$createdAt'}}}}]):[];const byKey=new Map(summaries.map(summary=>[String(summary._id),summary]));s.json({totalUsers,matchingUsers:customers.length,customers:customers.map(customer=>{const summary=byKey.get(String(customer._id))||byKey.get(customer.customerId);return{_id:customer._id,customerId:customer.customerId,name:customer.name,username:customer.username,createdAt:customer.createdAt,appointmentCount:summary?.appointmentCount||0,completedCount:summary?.completedCount||0,upcomingCount:summary?.upcomingCount||0,recentAppointment:summary?.recentAppointment||null}})});}));
app.get('/api/admin/reviews',auth,wrap(async(q,s)=>{const filter={};if(q.query.rating)filter.rating=Number(q.query.rating);const reviews=await Review.find(filter).populate('customerId','name customerId').populate('appointmentId','serviceName date time price status').sort({createdAt:-1});const total=await Review.countDocuments();const aggregate=await Review.aggregate([{$group:{_id:null,average:{$avg:'$rating'}}}]);s.json({reviews,total,average:aggregate[0]?.average||0})}));
app.patch('/api/admin/reviews/:id',auth,wrap(async(q,s)=>{if(typeof q.body.approved!=='boolean')throw Error('Approval status required');const r=await Review.findByIdAndUpdate(q.params.id,{approved:q.body.approved,updatedAt:new Date()},{new:true,runValidators:true});if(!r)return s.status(404).json({error:'Review not found'});s.json(r)}));
app.get('/api/settings',wrap(async(q,s)=>s.json(await cfg())));
app.put('/api/settings',auth,wrap(async(q,s)=>{const{address,phone,whatsapp}=q.body;if(!address||!phone)throw Error('Address and phone required');const hasSocialLinks=Object.prototype.hasOwnProperty.call(q.body,'socialLinks');const socialLinks=hasSocialLinks?q.body.socialLinks:[];if(!Array.isArray(socialLinks)||socialLinks.length>10)throw Error('Add up to 10 social media links');const cleanLinks=socialLinks.map(link=>{const name=String(link?.name||'').trim();const value=String(link?.url||'').trim();if(!name&&!value)return null;if(!name||!value)throw Error('Enter both a name and URL for every social media link');if(name.length>40||value.length>500)throw Error('Social media names must be 40 characters or fewer and URLs 500 characters or fewer');let parsed;try{parsed=new URL(value)}catch{throw Error(`Enter a valid URL for ${name}`)}if(!['http:','https:'].includes(parsed.protocol))throw Error(`Use an http or https URL for ${name}`);return{name,url:parsed.href}}).filter(Boolean);const c=await cfg();Object.assign(c,{address,phone,whatsapp:whatsapp||c.whatsapp,mapQuery:`B&W The Mens Saloon, ${address}`,...(hasSocialLinks?{socialLinks:cleanLinks}:{})});s.json(await c.save())}));
app.get('/api/gallery',wrap(async(q,s)=>s.json(await GalleryImage.find().sort({createdAt:-1,_id:-1}).lean())));
app.get('/api/admin/gallery',auth,wrap(async(q,s)=>s.json(await GalleryImage.find().sort({createdAt:-1,_id:-1}).lean())));
app.post('/api/admin/gallery',auth,handleGalleryUpload,wrap(async(q,s)=>{try{const images=await GalleryImage.insertMany(q.files.map(file=>({image:file.url})));s.status(201).json(images)}catch(error){await Promise.all(q.files.map(file=>removeOfferUpload(file.url)));throw error}}));
app.delete('/api/admin/gallery/:id',auth,wrap(async(q,s)=>{const image=await GalleryImage.findById(q.params.id);if(!image)return s.status(404).json({error:'Gallery image not found'});await image.deleteOne();await removeOfferUpload(image.image);s.json({ok:true})}));
app.get('/api/offers/active',wrap(async(q,s)=>{const today=new Date().toISOString().slice(0,10);const offers=await Offer.find({isActive:true,$and:[{$or:[{validFrom:{$exists:false}},{validFrom:''},{validFrom:{$lte:today}}]},{$or:[{validUntil:{$exists:false}},{validUntil:''},{validUntil:{$gte:today}}]}]}).sort({isFeatured:-1,createdAt:-1}).lean();s.json(offers.map(publicOffer))}));
app.get('/api/offers/admin',auth,wrap(async(q,s)=>s.json(await Offer.find().sort({createdAt:-1}).lean())));
app.post('/api/offers',auth,handleOfferUpload,wrap(async(q,s)=>{try{const offer=await Offer.create(offerPayload(q.body,null,q.file));s.status(201).json(offer)}catch(error){if(q.file)await removeOfferUpload(q.file.url);throw error}}));
app.put('/api/offers/:id',auth,handleOfferUpload,wrap(async(q,s)=>{let offer,saved=false;try{offer=await Offer.findById(q.params.id);if(!offer){if(q.file)await removeOfferUpload(q.file.url);return s.status(404).json({error:'Offer not found'})}const oldImageUrl=offer.imageUrl;Object.assign(offer,offerPayload(q.body,offer,q.file));await offer.save();saved=true;if(oldImageUrl!==offer.imageUrl)await removeOfferUpload(oldImageUrl);s.json(offer)}catch(error){if(q.file&&!saved)await removeOfferUpload(q.file.url);throw error}}));
app.patch('/api/offers/:id/status',auth,wrap(async(q,s)=>{if(typeof q.body.isActive!=='boolean')throw Error('Active status must be true or false');const offer=await Offer.findByIdAndUpdate(q.params.id,{isActive:q.body.isActive},{new:true,runValidators:true});if(!offer)return s.status(404).json({error:'Offer not found'});s.json(offer)}));
app.delete('/api/offers/:id',auth,wrap(async(q,s)=>{const offer=await Offer.findById(q.params.id);if(!offer)return s.status(404).json({error:'Offer not found'});await offer.deleteOne();await removeOfferUpload(offer.imageUrl);s.json({ok:true})}));
app.get('/api/services',wrap(async(q,s)=>s.json(await Service.find(q.query.all?{}:{active:true}).sort('createdAt'))));
app.get('/api/services/all',auth,wrap(async(q,s)=>s.json(await Service.find().sort('createdAt'))));
app.post('/api/services',auth,handleServiceUpload,wrap(async(q,s)=>{try{s.json(await Service.create({...q.body,...(q.file&&{image:q.file.url})}))}catch(error){if(q.file)await removeOfferUpload(q.file.url);throw error}}));
app.put('/api/services/:id',auth,handleServiceUpload,wrap(async(q,s)=>{try{const previous=await Service.findById(q.params.id);if(!previous){if(q.file)await removeOfferUpload(q.file.url);return s.status(404).json({error:'Service not found'})}const oldImage=previous.image;Object.assign(previous,q.body,q.file?{image:q.file.url}:{});await previous.save();if(q.file&&oldImage!==previous.image)await removeOfferUpload(oldImage);s.json(previous)}catch(error){if(q.file)await removeOfferUpload(q.file.url);throw error}}));
app.delete('/api/services/:id',auth,wrap(async(q,s)=>{const service=await Service.findByIdAndDelete(q.params.id);if(!service)return s.status(404).json({error:'Service not found'});await removeOfferUpload(service.image);s.json({ok:true})}));
app.get('/api/slots',wrap(async(q,s)=>{const taken=(await Appt.find({date:q.query.date,slotKey:{$exists:true}})).map(a=>a.time);s.json(SLOTS.map(t=>({time:t,booked:taken.includes(t)})))}));
app.post('/api/appointments',wrap(async(q,s)=>{const{serviceId,date,time,message=''}=q.body;let user=null;const bearer=(q.headers.authorization||'').replace(/^Bearer\s+/,'');if(bearer){try{const p=jwt.verify(bearer,JWT_SECRET);if(p.role==='customer')user=await User.findById(p.id)}catch{}}if(!user)return s.status(401).json({error:'Please log in to book an appointment'});
 if(!SLOTS.includes(time))throw Error('Invalid time slot');if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date<new Date().toISOString().slice(0,10))throw Error('Choose a valid future date');
 const sv=await Service.findOne({_id:serviceId,active:true});if(!sv)throw Error('Service unavailable');
 const bookingCounter=await Counter.findOneAndUpdate({_id:'bookingId'},{$inc:{seq:1}},{new:true,upsert:true});const appointment=await Appt.create({bookingId:'BW_A'+String(bookingCounter.seq).padStart(7,'0'),userId:user._id,customerId:user.customerId,name:user.name,serviceId,serviceName:sv.name,price:sv.price,duration:sv.duration,date,time,message:message.slice(0,300),slotKey:date+'_'+time,notificationAcknowledged:false});io.to(ADMIN_ROOM).emit('appointment:new',notificationFor(appointment));s.status(201).json(appointment)}));
app.get('/api/appointments',auth,wrap(async(q,s)=>{const filter={};if(q.query.date)filter.date=q.query.date;const search=String(q.query.search||'').trim();if(search){const escaped=search.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const matches=[{bookingId:{$regex:escaped,$options:'i'}},{customerId:{$regex:escaped,$options:'i'}},{name:{$regex:escaped,$options:'i'}},{serviceName:{$regex:escaped,$options:'i'}}];if(mongoose.Types.ObjectId.isValid(search))matches.push({_id:new mongoose.Types.ObjectId(search)});filter.$or=matches}s.json(await Appt.find(filter).sort({date:-1,time:1}))}));
app.patch('/api/customers/me/appointments/:id/cancel',customerAuth,wrap(async(q,s)=>{const a=await Appt.findOne({_id:q.params.id,userId:q.user.id});if(!a)return s.status(404).json({error:'Appointment not found'});if(!['pending','confirmed'].includes(a.status))return s.status(409).json({error:'This appointment can no longer be cancelled'});a.status='cancelled';a.slotKey=undefined;a.notificationAcknowledged=true;await a.save();s.json(a)}));
app.patch('/api/appointments/:id',auth,wrap(async(q,s)=>{const st=q.body.status;if(!['pending','confirmed','rejected','completed','cancelled'].includes(st))throw Error('Invalid appointment status');const u={$set:{status:st,notificationAcknowledged:true}};if(['rejected','cancelled'].includes(st))u.$unset={slotKey:1};const appointment=await Appt.findByIdAndUpdate(q.params.id,u,{new:true,runValidators:true});if(!appointment)return s.status(404).json({error:'Appointment not found'});io.to(ADMIN_ROOM).emit('appointment:updated',notificationFor(appointment));s.json(appointment)}));
const tryMongoConnect = async () => {
  const candidates = isProduction
    ? [configuredMongoUri]
    : [...new Set([configuredMongoUri, LOCAL_MONGO_URI].filter(Boolean))];
  let lastError;
  for (const uri of candidates) {
    try {
      await mongoose.connect(uri);
      if (uri !== configuredMongoUri && configuredMongoUri) {
        console.warn('Configured MongoDB connection failed; falling back to the local development database.');
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn('MongoDB connection attempt failed:', error.name);
    }
  }
  throw lastError;
};

const startServer=async()=>{
 try{
  await tryMongoConnect();
  await Appt.init();
  await Counter.updateOne({_id:'customerId'},{$setOnInsert:{seq:0}},{upsert:true});
  await Counter.updateOne({_id:'bookingId'},{$setOnInsert:{seq:0}},{upsert:true});
  await cfg();
  if(!await Service.countDocuments())await Service.insertMany(SEED.map(([name,price,duration,i,description])=>({name,price,duration,description,image:img(i)})));
  httpServer.on('error',error=>{
   if(error.code==='EADDRINUSE')console.error(`Port ${PORT} is already in use. The API may already be running; use it as-is, or stop the existing process before starting another instance.`);
   else console.error('API server failed to start:',error.name);
   mongoose.disconnect().finally(()=>process.exit(1));
  });
  httpServer.listen(PORT,()=>console.log('API on '+PORT));
 }catch(error){
  console.error('API startup failed:',error.name);
  process.exit(1);
 }
};
void startServer();
