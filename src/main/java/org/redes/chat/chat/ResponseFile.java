package org.redes.chat.chat;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@NoArgsConstructor
@Getter
@Setter
public class ResponseFile {
    private String message;
    private boolean success;
    private String filePath;
    
    public ResponseFile(String message, boolean success, String filePath) {
        this.message = message;
        this.success = success;
        this.filePath = filePath;
    }

    public ResponseFile(String message, boolean success) {
        this.message = message;
        this.success = success;
    }
}
