import express from 'express';
const app = express();

import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore, collection, query, where, updateDoc, getDocs, addDoc } from "firebase/firestore";
import dotenv from 'dotenv';
import schedule from 'node-schedule';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

const PORT = process.env.PORT || 5000;

const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    projectId: process.env.FIREBASE_PROJECT_ID,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.FIREBASE_ID,
    measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase);
const firestore = getFirestore(appFirebase);
const db2 = firestore;

// Supabase
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Middleware para parsear JSON
app.use(express.json());

// Endpoint para manejar los clics
app.post('/clicks', async (req, res) => {
    const data = req.body;
    
    console.log('Received data:', data);
    
    // Obtener el documento existente
    const docRef = doc(db, "organizations", "nckCUr0CEm9yShDFolKh");
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
        // Obtener el array existente en clicksLabsMobile
        const existingData = docSnap.data().clicksLabsMobile;
        
        // Agregar los nuevos datos al array
        const updatedData = [...existingData, data];
        
        // Actualizar el documento con el nuevo array
        await updateDoc(docRef, {
            clicksLabsMobile: updatedData
        });
        
        console.log("Document updated successfully");
        res.status(200).json({ status: 'success', message: 'Data received' });
    } else {
        console.log("Document does not exist");
        res.status(404).json({ status: 'error', message: 'Document not found' });
    }
});

// Función para verificar condiciones de la conversación
const checkConversations = async () => {
    console.log('Checking conversations...');

    const { data: conversations, error } = await supabase
      .from('chat_history')
      .select('id, agreement, messages, notification_sent, client_number')
      .eq('agreement', false) // Obtener las conversaciones donde el acuerdo es false
      .eq('notification_sent', false); // Solo las conversaciones sin notificación enviada
  
    if (error) {
      console.error('Error fetching conversations:', error);
      return;
    }
  
    const now = new Date();

    for (const conversation of conversations) {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const lastMessageDate = new Date(lastMessage.date);
        const timeDiff = now - lastMessageDate; 

        // Verifica ambas condiciones: acuerdo es false y más de 3 horas sin interacción
        if (conversation.agreement === false && timeDiff >= 3 * 60 * 60 * 1000 && timeDiff <= 5 * 60 * 60 * 1000
        ) {
            // Genera la notificación si no ha sido creada
            if (!conversation.notification_sent) {
                const date = new Date();
                const options = {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric',
                    hour12: true,
                    timeZone: 'America/Bogota'
                };
                const formattedDate = new Intl.DateTimeFormat('es-CO', options).format(date);
                
                const notification = {
                    id: uuidv4(),
                    name: 'Chat Alert',
                    date: formattedDate,
                    for: 'pruebas@coltefinanciera.com',
                    from: conversation.client_number,
                    type: 'new_message',
                    message: 'You have unfinished conversations',
                    isArchived: false,
                    isRead: false,
                    icon: 'https://firebasestorage.googleapis.com/v0/b/ultim-admin-dashboard.appspot.com/o/avatar%2Fmessage-square-exclamation-svgrepo-com.svg?alt=media&token=c1515841-8574-4dc8-9d51-d6cfa1dd9d34',
                };

                await createNotification('coltefinanciera', notification);

                // Marca la conversación como notificada
                await supabase
                  .from('chat_history')
                  .update({ notification_sent: true })
                  .eq('id', conversation.id);
            }
        }

        // Si pasan 24 horas sin interacción, se cierra la conversación y se resetea notification_sent a false
        if (timeDiff >= 24 * 60 * 60 * 1000) {
            await supabase
              .from('chat_history')
              .update({ notification_sent: false })
              .eq('id', conversation.id);
        }
    }
};
  
// Programar la tarea cada minuto
// schedule.scheduleJob('*/1 * * * *', checkConversations); // Cada minuto
schedule.scheduleJob('0 * * * *', checkConversations); // Cada hora

// Crear notificación
export const createNotification = async (organizationName, notification) => {
    const orgsRef = collection(db2, 'organizations'); 
    // Mail Ref de Firestore
    const mailRef = collection(db2, 'mail');

    const q = query(orgsRef, where('name', '==', organizationName)); 
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
        console.log('No organization found with that name.');
        return;
    }

    const docSnapshot = querySnapshot.docs[0];
    const docId = docSnapshot.id;

    const notifications = docSnapshot.data().notifications || [];
    console.log('Notifications before:', notifications);

    notifications.push(notification);

    const docRef = doc(db2, 'organizations', docId);

    await updateDoc(docRef, {
      notifications: notifications
    });

    const emailContent = {
        to: ['alejobetancur2@gmail.com'], // Este es el correo de Monica de Colectora
        message: {
            subject: `New chat alert from ${notification.from}`,
            text: notification.message,
            html: `
                <h1>New Chat Alert</h1>
                <p>${notification.message}</p>
                <p>From: ${notification.from}</p>
                <p>Date: ${notification.date}</p>
                <p>Contact the customer as soon as possible</p>
            `
        }
    };
    await addDoc(mailRef, emailContent);

    console.log('Notification created successfully');
};

// Get prueba
app.get('/', (req, res) => {
    res.send('Hello World');
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
