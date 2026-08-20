import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-database.js";
import { firebaseConfig } from "/firebase-config.js";
const app=initializeApp(firebaseConfig),auth=getAuth(app),database=getDatabase(app),$=(id)=>document.getElementById(id);
function fillUser(user,profile){const name=profile.fullName||user.displayName||"Usuario";$("hubUserName").textContent=name;if(user.photoURL){const image=document.createElement("img");image.src=user.photoURL;image.alt=name;image.referrerPolicy="no-referrer";$("hubAvatar").replaceChildren(image)}else $("hubAvatar").textContent=name.slice(0,2).toUpperCase()}
onAuthStateChanged(auth,async(user)=>{if(!user){window.location.replace("/study/panel");return}try{const snapshot=await get(ref(database,`users/${user.uid}/profile`)),profile=snapshot.val();if(!profile?.completed){window.location.replace("/study/panel/ingreso");return}fillUser(user,profile);$("hubLoading").classList.add("hidden");$("dashboard").classList.remove("hidden")}catch(error){console.error(error);window.location.replace("/study/panel/ingreso")}});
function closeMenu(){$("sidebar").classList.remove("open");$("sidebarOverlay").classList.remove("visible")}
$("collapseButton").addEventListener("click",()=>$("sidebar").classList.toggle("collapsed"));
$("mobileMenuButton").addEventListener("click",()=>{$("sidebar").classList.add("open");$("sidebarOverlay").classList.add("visible")});$("sidebarOverlay").addEventListener("click",closeMenu);
document.querySelectorAll(".nav-item").forEach(item=>item.addEventListener("click",()=>{document.querySelector(".nav-item.active")?.classList.remove("active");item.classList.add("active");$("sectionTitle").textContent=item.querySelector("span").textContent;document.querySelector(".placeholder-icon i").className=item.querySelector("i").className;closeMenu()}));
$("hubLogout").addEventListener("click",async()=>{await signOut(auth);window.location.replace("/")});
