import { PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
/**
 * Fan Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export declare class FanAccessory extends BaseAccessory {
    private readonly platform;
    private readonly accessory;
    private servicePower;
    private serviceSpeedUp;
    private serviceSpeedDown;
    private serviceVSwing;
    private serviceHSwing;
    private fanStates;
    private powerCommand;
    private speedUpCommand;
    private speedDownCommand;
    private swingCommand;
    private verticalSwingCommand;
    private swingSave;
    private hasVSwing;
    private swingPower;
    private categoryId;
    constructor(platform: TuyaIRPlatform, accessory: PlatformAccessory);
    setOn(value: CharacteristicValue): Promise<void>;
    getOn(): Promise<CharacteristicValue>;
    getRotationSpeedUpDown(): Promise<CharacteristicValue>;
    setRotationSpeedUp(value: CharacteristicValue): Promise<void>;
    setRotationSpeedDown(value: CharacteristicValue): Promise<void>;
    private getSwingMode;
    private setSwingMode;
    getVerticalSwing(): Promise<CharacteristicValue>;
    setVerticalSwing(value: CharacteristicValue): Promise<void>;
    updateFanActive(): void;
    setSwingActive(): void;
    private getFanCommands;
    private sendFanCommand;
    private getIRCodeFromKey;
    private getDIYIRCodesFromAPIResponse;
    private getStandardIRCodesFromAPIResponse;
    private process_commands;
}
//# sourceMappingURL=FanAccessory.d.ts.map