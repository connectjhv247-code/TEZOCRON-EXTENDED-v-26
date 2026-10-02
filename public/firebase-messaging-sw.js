importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyC4IG-THBNaXn9FxhWQ3HZlugKouK5Ekpk",
  authDomain: "tezocron-extended-v2.firebaseapp.com",
  projectId: "tezocron-extended-v2",
  messagingSenderId: "859569585050",
  appId: "1:859569585050:web:82df17e07f4f1fd0495823"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification?.title || 'TEZOCRON EXTENDED';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: payload.notification?.icon || '/tezocron_logo.svg',
    data: payload.data,
  };
  self.registration.showNotification(notificationTitle, notificationOptions);
});
