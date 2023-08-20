"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Command = void 0;
class Command {
    constructor({ key_id, key = "" }, isDIY = false) {
        this.isDIY = false;
        this.key = {
            id: -1,
            name: ""
        };
        this.key.id = key_id;
        this.key.name = key;
        this.isDIY = isDIY;
    }
}
exports.Command = Command;
//# sourceMappingURL=Command.js.map