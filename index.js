import express from 'express';
const app = express();

import { initializeApp } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import { updateDoc } from "firebase/firestore"; 
import dotenv from 'dotenv';

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

// Initialize Firebase
const appFirebase = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
const db = getFirestore(appFirebase);

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

// Get prueba
app.get('/', (req, res) => {
    res.send('Hello World');
});

// Inicia el servidor
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
