package com.codesync.syncservice.dto;

/**
 * Mensagem Yjs/CRDT para colaboração em tempo real.
 * O campo 'update' contém o delta binário do Yjs codificado em Base64.
 */
public class YjsMessage {

    private String fileId;
    private String userId;
    private String update; // Base64-encoded Yjs binary update

    public YjsMessage() {
    }

    public String getFileId() {
        return fileId;
    }

    public void setFileId(String fileId) {
        this.fileId = fileId;
    }

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId;
    }

    public String getUpdate() {
        return update;
    }

    public void setUpdate(String update) {
        this.update = update;
    }
}
