// auth.js
import { signInWithEmailAndPassword, onAuthStateChanged, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import { auth } from '../firebase-init.js';

export async function signIn(email, password){
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return userCredential.user;
    } catch (error) {
        // 將 firebase 的錯誤訊息轉成使用者可讀格式
        let msg = error.message || '登入失敗';
        // 常見錯誤 key mapping
        if (error.code) {
            if (error.code === 'auth/user-not-found') msg = '找不到使用者';
            if (error.code === 'auth/wrong-password') msg = '密碼錯誤';
            if (error.code === 'auth/invalid-email') msg = 'Email 格式不正確';
        }
        throw new Error(msg);
    }
}

export function onAuthChange(callback){
    return onAuthStateChanged(auth, callback);
}

export async function signOut(){
    await firebaseSignOut(auth);
}
