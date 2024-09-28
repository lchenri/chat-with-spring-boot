package org.redes.chat.chat;

import org.apache.coyote.Response;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;

@Controller
public class ChatController {

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage){
        return chatMessage;
    }

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor){
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        return chatMessage;
    }

    @PostMapping("/chat.sendFile")
    public ResponseEntity<ResponseFile> receiveFile(@RequestBody ChatFile chatFile){

        if(chatFile.getArquivo() == null){
            ResponseFile responseFile = new ResponseFile("Arquivo não foi recebido", false);
            return ResponseEntity.badRequest().body(responseFile);
        }
        ResponseFile responseImage = new ResponseFile("Arquivo recebido com sucesso", true);
        return ResponseEntity.ok(responseImage);
    }

    @MessageMapping("/chat.sendFile")
    @SendTo("/topic/public")
    public ChatMessage sendFile(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor){
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        return chatMessage;
    }
}
