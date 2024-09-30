'use strict';

var usernamePage = document.querySelector('#username-page');
var chatPage = document.querySelector('#chat-page');
var usernameForm = document.querySelector('#usernameForm');
var messageForm = document.querySelector('#messageForm');
var messageInput = document.querySelector('#message');
var messageArea = document.querySelector('#messageArea');
var connectingElement = document.querySelector('.connecting');

var stompClient = null;
var username = null;
var userPublicKey = null;
var userPrivateKey = null;
var otherUserPublicKeys = {};

var colors = [
    '#2196F3', '#32c787', '#00BCD4', '#ff5652',
    '#ffc107', '#ff85af', '#FF9800', '#39bbb0'
];

async function generateKeyPair() {
    const keyPair = await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP",
            modulusLength: 2048,
            publicExponent: new Uint8Array([1, 0, 1]),
            hash: "SHA-256"
        },
        true,
        ["encrypt", "decrypt"]
    );
    return keyPair;
}

async function exportPublicKey(key) {
    const exported = await window.crypto.subtle.exportKey("spki", key);
    return btoa(String.fromCharCode(...new Uint8Array(exported)));
}

async function importPublicKey(pemKey) {
    const binaryDerString = window.atob(pemKey);  // Decodifica Base64 para binário
    const binaryDer = str2ab(binaryDerString);  // Converte para ArrayBuffer

    return window.crypto.subtle.importKey(
        "spki",  // O formato da chave pública
        binaryDer,
        {
            name: "RSA-OAEP",
            hash: {name: "SHA-256"}
        },
        true,
        ["encrypt"]
    );
}

function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

async function encryptMessage(publicKey, message) {
    const encodedMessage = new TextEncoder().encode(message);
    const encrypted = await window.crypto.subtle.encrypt(
        {
            name: "RSA-OAEP"
        },
        publicKey,
        encodedMessage
    );
    return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
}

async function decryptMessage(privateKey, encryptedMessage) {
    const binaryMessage = atob(encryptedMessage);
    const encryptedData = new Uint8Array([...binaryMessage].map(char => char.charCodeAt(0)));

    const decrypted = await window.crypto.subtle.decrypt(
        {
            name: "RSA-OAEP"
        },
        privateKey,
        encryptedData
    );
    return new TextDecoder().decode(decrypted);
}

async function connect(event) {
    event.preventDefault();
    username = document.querySelector('#name').value.trim();

    if (username) {
        usernamePage.classList.add('hidden');
        chatPage.classList.remove('hidden');

        const keyPair = await generateKeyPair();
        userPublicKey = keyPair.publicKey;
        userPrivateKey = keyPair.privateKey;

        const exportedPublicKey = await exportPublicKey(userPublicKey);

        var socket = new SockJS('/ws');
        stompClient = Stomp.over(socket);
        stompClient.debug = null;

        stompClient.connect({}, async function() {
            try {
                console.log("Conexão bem-sucedida!");
                
                stompClient.send("/app/chat.addUser", {}, JSON.stringify({ sender: username, content: exportedPublicKey, type: 'JOIN' }));
                console.log("Mensagem JOIN enviada");

                stompClient.subscribe('/topic/public', onMessageReceived);
                console.log("Inscrição no tópico 'public' realizada");

                connectingElement.classList.add('hidden');
            } catch (error) {
                console.error("Erro ao enviar mensagens após conexão:", error);
            }
        }, onError);
    }
}

function onConnected() {
    stompClient.subscribe('/topic/public', onMessageReceived);

    stompClient.send("/app/chat.addUser",
        {},
        JSON.stringify({sender: username, type: 'JOIN'})
    )

    connectingElement.classList.add('hidden');
}


function onError(error) {
    connectingElement.textContent = 'Não foi possível conectar ao servidor websocket!';
    connectingElement.style.color = 'red';
}


async function sendMessage(event) {
    event.preventDefault();
    var messageContent = messageInput.value.trim();

    if (messageContent && stompClient) {
        const encryptedMessages = [];
        for (const recipient in otherUserPublicKeys) {
            const publicKeyPem = otherUserPublicKeys[recipient];
            const publicKey = await importPublicKey(publicKeyPem);
            const encrypted = await encryptMessage(publicKey, messageContent);
            encryptedMessages.push({ recipient: recipient, encryptedContent: encrypted });
        }

        stompClient.send("/app/chat.sendMessage", {}, JSON.stringify({
            sender: username,
            content: JSON.stringify(encryptedMessages),
            type: 'CHAT'
        }));
        
        messageInput.value = '';
    }
}


async function onMessageReceived(payload) {
    var message = JSON.parse(payload.body);

    var messageElement = document.createElement('li');
    console.log(message);

    if(message.type === 'JOIN') {

        let keysObj = JSON.parse(message.content)
        console.log('Keys Json: ', keysObj)
        otherUserPublicKeys = keysObj

        messageElement.classList.add('event-message');
        message.content = message.sender + ' entrou!';
        messageElement.innerHTML = message.content;
        messageArea.appendChild(messageElement);
        messageArea.scrollTop = messageArea.scrollHeight;
    } else if (message.type === 'LEAVE') {
        messageElement.classList.add('event-message');
        message.content = message.sender + ' saiu!';
        messageElement.innerHTML = message.content;
        messageArea.appendChild(messageElement);
        messageArea.scrollTop = messageArea.scrollHeight;
    } else if (message.type === 'CHAT') {
        const encryptedMessages = JSON.parse(message.content);
        for (let encryptedMessage of encryptedMessages) {
            if (encryptedMessage.recipient === username) {
                const decryptedMessage = await decryptMessage(userPrivateKey, encryptedMessage.encryptedContent);
                messageElement.classList.add('chat-message');

                var avatarElement = document.createElement('i');
                var avatarText = document.createTextNode(message.sender[0]);
                avatarElement.appendChild(avatarText);
                avatarElement.style['background-color'] = getAvatarColor(message.sender);
        
                messageElement.appendChild(avatarElement);
        
                var usernameElement = document.createElement('span');
                var usernameText = document.createTextNode(message.sender);
                usernameElement.appendChild(usernameText);
                messageElement.appendChild(usernameElement);
                        
                var textElement = document.createElement('p');
                textElement.innerHTML += decryptedMessage;

                messageElement.appendChild(textElement);

                messageArea.appendChild(messageElement);
                messageArea.scrollTop = messageArea.scrollHeight;
            }
        }
    }
}


function getAvatarColor(messageSender) {
    var hash = 0;
    for (var i = 0; i < messageSender.length; i++) {
        hash = 31 * hash + messageSender.charCodeAt(i);
    }
    var index = Math.abs(hash % colors.length);
    return colors[index];
}

function sendFile(event) {
    event.preventDefault();
    if (fileInput.files.length > 0) {
        const file = fileInput.files[0];
        const reader = new FileReader();

        reader.onload = function(e) {
            const base64String = e.target.result.split(',')[1];
            
            const data = {
                nomearquivo: file.name,
                arquivo: base64String
            };

            fetch('http://localhost:8080/chat.sendFile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                if (!response.ok) {
                    throw new Error('Erro ao enviar o arquivo');
                }
                return response.json();
            })
            .then(async (data) => {
                let messageLog = `Arquivo enviado: <a href='${data.filePath}'>Clique para Download</a>'`;
                const encryptedMessages = [];
                for (const recipient in otherUserPublicKeys) {
                    const publicKeyPem = otherUserPublicKeys[recipient];
                    const publicKey = await importPublicKey(publicKeyPem);
                    const encrypted = await encryptMessage(publicKey, messageLog);
                    encryptedMessages.push({ recipient: recipient, encryptedContent: encrypted });
                }

                stompClient.send("/app/chat.sendMessage", {}, JSON.stringify({
                    sender: username,
                    content: JSON.stringify(encryptedMessages),
                    type: 'CHAT'
                }));
                console.log(chatMessage);
                stompClient.send("/app/chat.sendMessage", {}, JSON.stringify(chatMessage));
            })
            .catch(error => {
                console.error('Erro ao enviar o arquivo:', error);
            });

            fileInput.value = '';
        };

        reader.readAsDataURL(file);
    }
}

usernameForm.addEventListener('submit', connect, true);
messageForm.addEventListener('submit', sendMessage, true);

document.getElementById('file-button').addEventListener('click', function() {
    fileInput.click();
});

fileInput.addEventListener('change', sendFile);