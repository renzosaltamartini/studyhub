import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";
import { createClient } from "@supabase/supabase-js";

const BUCKET = process.env.SUPABASE_BUCKET || "studyhub-files";
const MAX_FILE_SIZE = 25 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-rar-compressed",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp"
]);
const STAFF_EMAILS=new Set(["renzosaltamartini2008@gmail.com","studyhubyrenzo@gmail.com"]);

function firebaseAdmin(){
  if(!getApps().length){
    const privateKey=(process.env.FIREBASE_PRIVATE_KEY||"").replace(/\\n/g,"\n");
    initializeApp({credential:cert({
      projectId:process.env.FIREBASE_PROJECT_ID,
      clientEmail:process.env.FIREBASE_CLIENT_EMAIL,
      privateKey
    }),databaseURL:process.env.FIREBASE_DATABASE_URL});
  }
  const app=getApps()[0];
  return {auth:getAuth(app),database:getDatabase(app)};
}

function supabaseAdmin(){
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw new Error("Faltan variables de Supabase en Vercel.");
  return createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
}

function safePath(uid,path){
  return typeof path==="string"&&path.startsWith(`${uid}/`)&&!path.includes("..")&&!path.includes("\\")&&path.length<=500;
}

function structurallySafePath(path){
  return typeof path==="string"&&!path.includes("..")&&!path.includes("\\")&&path.length>3&&path.length<=500;
}

async function canReadChatAttachment(database,decoded,path,chatId){
  if(!/^\d+$/.test(String(chatId||""))||!structurallySafePath(path))return false;
  const chat=(await database.ref(`contactChats/${chatId}`).get()).val();
  if(!chat)return false;
  const email=String(decoded.email||"").toLowerCase();
  if(chat.ownerUid!==decoded.uid&&!STAFF_EMAILS.has(email))return false;
  return Object.values(chat.messages||{}).some(message=>message?.attachmentPath===path&&path.startsWith(`${message.senderUid}/chat/${chatId}/`));
}

export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({error:"Método no permitido."});
  try{
    const authorization=req.headers.authorization||"";
    if(!authorization.startsWith("Bearer "))return res.status(401).json({error:"Falta iniciar sesión."});
    const services=firebaseAdmin();
    const decoded=await services.auth.verifyIdToken(authorization.slice(7));
    const {action,path,contentType,size,upsert,download,chatId}=req.body||{};
    const ownsPath=safePath(decoded.uid,path);
    const storage=supabaseAdmin().storage.from(BUCKET);

    if(action==="create-upload"){
      if(!ownsPath)return res.status(403).json({error:"Ruta de archivo no permitida."});
      if(!ALLOWED_TYPES.has(contentType))return res.status(400).json({error:"Este tipo de archivo no está permitido."});
      if(!Number.isFinite(size)||size<=0||size>MAX_FILE_SIZE)return res.status(400).json({error:"El archivo debe pesar como máximo 25 MB."});
      const {data,error}=await storage.createSignedUploadUrl(path,{upsert:Boolean(upsert)});
      if(error)throw error;
      return res.status(200).json({path:data.path,token:data.token});
    }
    if(action==="signed-url"){
      if(!ownsPath&&!(await canReadChatAttachment(services.database,decoded,path,chatId)))return res.status(403).json({error:"No tienes acceso a este adjunto."});
      const options=download?{download:String(download).slice(0,160)}:undefined;
      const {data,error}=await storage.createSignedUrl(path,3600,options);
      if(error)throw error;
      return res.status(200).json({url:data.signedUrl});
    }
    if(action==="delete"){
      if(!ownsPath)return res.status(403).json({error:"No puedes eliminar este archivo."});
      const {error}=await storage.remove([path]);
      if(error)throw error;
      return res.status(200).json({ok:true});
    }
    return res.status(400).json({error:"Acción desconocida."});
  }catch(error){
    console.error(error);
    const unauthorized=/token|credential|argument/i.test(error?.code||"");
    return res.status(unauthorized?401:500).json({error:unauthorized?"La sesión no es válida.":error.message||"Error de almacenamiento."});
  }
}
