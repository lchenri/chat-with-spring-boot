package org.redes.chat.chat;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

@Controller
public class ChatController {

    private Map<String, String> publicKeys = new HashMap<>();

    @MessageMapping("/chat.addUser")
    @SendTo("/topic/public")
    public ChatMessage addUser(@Payload ChatMessage chatMessage, SimpMessageHeaderAccessor headerAccessor) throws JsonProcessingException {
        headerAccessor.getSessionAttributes().put("username", chatMessage.getSender());
        publicKeys.put(chatMessage.getSender(), chatMessage.getContent());

        ObjectMapper objectMapper = new ObjectMapper();
        String publicKeysJson = objectMapper.writeValueAsString(publicKeys);

        ChatMessage joinMessage = new ChatMessage();
        joinMessage.setType(MessageType.JOIN);
        joinMessage.setSender(chatMessage.getSender());
        joinMessage.setContent(publicKeysJson);
 
        return joinMessage;
    }

    @MessageMapping("/chat.sendMessage")
    @SendTo("/topic/public")
    public ChatMessage sendMessage(@Payload ChatMessage chatMessage){
        return chatMessage;
    }

    @PostMapping("/chat.sendFile")
    public ResponseEntity<ResponseFile> receiveFile(@RequestBody ChatFile chatFile) {
        if (chatFile.getArquivo() == null || chatFile.getNomearquivo() == null) {
            ResponseFile responseFile = new ResponseFile("Arquivo não foi recebido", false);
            return ResponseEntity.badRequest().body(responseFile);
        }

        try {
            String fileName = chatFile.getNomearquivo();
            String filePath = "src/main/resources/static/files/" + fileName;

            byte[] fileData = Base64.getDecoder().decode(chatFile.getArquivo());

            try (FileOutputStream fos = new FileOutputStream(new File(filePath))) {
                fos.write(fileData);
                fos.flush();
            }

            String serverPath = "http://localhost:8080/files/" + fileName;
 
            ResponseFile responseFile = new ResponseFile("Arquivo recebido com sucesso", true, serverPath);
            return ResponseEntity.ok(responseFile);
        } catch (IOException e) {
            e.printStackTrace();
            ResponseFile responseFile = new ResponseFile("Erro ao salvar o arquivo: " + e.getMessage(), false);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(responseFile);
        } catch (Exception e) {
            e.printStackTrace();
            ResponseFile responseFile = new ResponseFile("Erro ao salvar o arquivo: " + e.getMessage(), false);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(responseFile);
        }
    }

    @GetMapping("/files/{filename}")
    @ResponseBody
    public ResponseEntity<InputStreamResource> serveFile(@PathVariable String filename) {
        try {
            File file = new File("src/main/resources/static/files/" + filename);
            FileInputStream fis = new FileInputStream(file);
            InputStreamResource resource = new InputStreamResource(fis);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + file.getName() + "\"")
                    .contentLength(file.length())
                    .body(resource);
        } catch (IOException e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}
