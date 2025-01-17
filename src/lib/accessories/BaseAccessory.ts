import { Logger, PlatformAccessory } from "homebridge";
import { TuyaIRPlatform } from "../../platform";
import { TuyaIRConfiguration } from "../model/TuyaIRConfiguration";

export class BaseAccessory {
    protected parentId = "";
    protected deviceId = ""
    protected configuration: TuyaIRConfiguration;
    protected log: Logger;

    constructor(platform: TuyaIRPlatform, accessory: PlatformAccessory) {
        this.parentId = accessory.context.device.ir_id;
        this.deviceId = accessory.context.device.id;
        this.configuration = accessory.context.device.config;
        this.log = platform.log;
    }
}