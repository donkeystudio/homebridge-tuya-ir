export class Command {
    public isDIY = false;
    public key = {
        id : -1,
        name : ""
    }
    
    constructor({key_id, key=""}, isDIY = false) {
        this.key.id = key_id;
        this.key.name = key
        this.isDIY = isDIY;
    }
}