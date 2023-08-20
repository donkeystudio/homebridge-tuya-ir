import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
import { APIInvocationHelper } from '../api/APIInvocationHelper';
import { Command } from '../model/Command';

/**
 * Fan Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */

export class FanAccessory extends BaseAccessory {
    private servicePower: Service;
    private serviceSpeedUp: Service;
    private serviceSpeedDown: Service;
    private serviceVSwing: Service;
    private serviceHSwing: Service;

    private fanStates = {
        On: false,
        swing: false,
        speedBeingChanged: false,
        verticalSwing: false
    };

    private powerCommand = new Command({key_id: 1});
    private speedUpCommand = new Command({key_id: 9367});
    private speedDownCommand = new Command({key_id: 9367});
    private swingCommand = new Command({key_id: 9372});
    private verticalSwingCommand = new Command({key_id: 9372});
    private swingSave = false;
    private hasVSwing = false;
    private swingPower = false;
    private categoryId = "";

    constructor(
        private readonly platform: TuyaIRPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        super(platform, accessory);

        this.swingSave 	= accessory.context.device.swingSave;
        this.hasVSwing 	= accessory.context.device.hasVSwing;
        this.swingPower	= accessory.context.device.swingPower;

        this.accessory?.getService(this.platform.Service.AccessoryInformation)
            ?.setCharacteristic(this.platform.Characteristic.Manufacturer, accessory.context.device.brand)
            .setCharacteristic(this.platform.Characteristic.Model, accessory.context.device.model)
            .setCharacteristic(this.platform.Characteristic.SerialNumber, accessory.context.device.id);

        /********
        * Create Power Service
        */
        this.servicePower = this.accessory.getService(this.platform.Service.Switch) || this.accessory.addService(this.platform.Service.Switch);

        this.servicePower.setCharacteristic(this.platform.Characteristic.Name, accessory.context.device.name);
        this.servicePower.subtype = "Fan";

        this.servicePower.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setOn.bind(this))
            .onGet(this.getOn.bind(this));

		/********
        * Create Horizontal Swing Service
        */
        this.serviceHSwing = this.accessory.getService(accessory.context.device.name + "Swing") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Swing", "Swing");

        this.serviceHSwing.setCharacteristic(this.platform.Characteristic.Name, "Swing");
        this.serviceHSwing.subtype = "Swing";

        this.serviceHSwing.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setSwingMode.bind(this))
            .onGet(this.getSwingMode.bind(this));

		/********
        * Create Speed Up service
        */
        this.serviceSpeedUp = this.accessory.getService(accessory.context.device.name + "Speed Up") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Speed Up", "Speed Up");

        this.serviceSpeedUp.setCharacteristic(this.platform.Characteristic.Name, "Speed Up");
        this.serviceSpeedUp.subtype = "Speed Up";

        this.serviceSpeedUp.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setRotationSpeedUp.bind(this))
            .onGet(this.getRotationSpeedUpDown.bind(this));
        
        /********
        * Create Speed Down service
        */
        this.serviceSpeedDown = this.accessory.getService(accessory.context.device.name + "Speed Down") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Speed Down", "Speed Down");
        
        this.serviceSpeedDown.setCharacteristic(this.platform.Characteristic.Name, "Speed Down");
        this.serviceSpeedDown.subtype = "Speed Down";

        this.serviceSpeedDown.getCharacteristic(this.platform.Characteristic.On)
            .onSet(this.setRotationSpeedDown.bind(this))
            .onGet(this.getRotationSpeedUpDown.bind(this));
            
        /********
        * Create Vertical Swing service
        */
        this.serviceVSwing = this.accessory.getService(accessory.context.device.name + "Vertical Swing") || this.accessory.addService(this.platform.Service.Switch, accessory.context.device.name + "Vertical Swing", "Vertical Swing");
        
		this.serviceVSwing.setCharacteristic(this.platform.Characteristic.Name, "Vertical Swing");
		this.serviceVSwing.subtype = "Vertical Swing";

		this.serviceVSwing.getCharacteristic(this.platform.Characteristic.On)
			.onSet(this.setVerticalSwing.bind(this))
			.onGet(this.getVerticalSwing.bind(this));
        
        this.getFanCommands(accessory.context.device.diy);
    }

    async setOn(value: CharacteristicValue) 
    {
        const command = this.powerCommand;

		this.sendFanCommand(command, (body) => {
			if (!body.success) {
				this.platform.log.error(`Failed to change Fan status due to error ${body.msg}`);
			} else {
				this.platform.log.info(`${this.accessory.displayName} is now ${(value as number) == 0 ? 'Off' : 'On'}`);
				
				this.fanStates.On = value as boolean;
				
				//Try to enable swing after turning on the fan
				if (!this.swingSave)
				{
					if (this.fanStates.On)
					{
						this.setSwingActive();
					}
					else
					{
						this.fanStates.swing = false;
						//Set and execute Swing
						this.serviceHSwing.updateCharacteristic(this.platform.Characteristic.On, this.fanStates.swing);	
					}
				}
				
			}
		});
    }

    async getOn(): Promise<CharacteristicValue> {
        return this.fanStates.On;
    }

    async getRotationSpeedUpDown(): Promise<CharacteristicValue> {
        return false;
    }

    async setRotationSpeedUp(value: CharacteristicValue) {
        const command  = this.speedUpCommand;

        this.sendFanCommand(command, (body) => {
            if (!body.success) {
                this.log.error(`Failed to change Fan speed due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
                
				if (this.swingPower && !this.fanStates.On)
				{
					if (!this.swingSave)
					{
						this.setSwingActive();
					}
					else
					{
						this.updateFanActive();
					}
				}
                this.serviceSpeedUp.updateCharacteristic(this.platform.Characteristic.On, false);
            }
        }); 
    }
    
    async setRotationSpeedDown(value: CharacteristicValue) {
        const command  = this.speedDownCommand;

        this.sendFanCommand(command, (body) => {
            if (!body.success) {
                this.platform.log.error(`Failed to change Fan speed due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} speed is updated.`);
                if (this.swingPower && !this.fanStates.On)
				{
					if (!this.swingSave)
					{
						this.setSwingActive();
					}
					else
					{
						this.updateFanActive();
					}
				}
                this.serviceSpeedDown.updateCharacteristic(this.platform.Characteristic.On, false);
            }
        });
    }

    private getSwingMode() {
        return this.fanStates.swing;
    }

    private setSwingMode(value: CharacteristicValue) {
        this.sendFanCommand(this.swingCommand, (body) => {
            if (!body.success) {
                this.log.error(`Failed to change Fan swing due to error ${body.msg}`);
            } else {
                this.platform.log.info(`${this.accessory.displayName} swing is updated.`);
                this.fanStates.swing = value as boolean;
                if (this.swingPower)
                    this.updateFanActive();
            }
        });
    }
    
    async getVerticalSwing(): Promise<CharacteristicValue> {
        return this.fanStates.verticalSwing;
    }

    async setVerticalSwing(value: CharacteristicValue) {
		if (this.hasVSwing)
		{
			const command = this.verticalSwingCommand;

			this.sendFanCommand(command, (body) => {
				if (!body.success) {
					this.platform.log.error(`Failed to change Fan swing due to error ${body.msg}`);
				} else {
					this.platform.log.info(`${this.accessory.displayName} swing is updated.`);
					this.fanStates.verticalSwing = value as boolean;
					if (this.swingPower)
						this.updateFanActive();
				}
			});
		}
    }
    
    updateFanActive()
    {
        this.fanStates.On = true;
		this.servicePower.updateCharacteristic(this.platform.Characteristic.On, this.fanStates.On);
    }
    
    setSwingActive()
    {
        this.fanStates.swing = true;
        //Set and execute Swing
		this.serviceHSwing.setCharacteristic(this.platform.Characteristic.On, this.fanStates.swing);		
    }

    private getFanCommands(isDiy = false) {
        this.log.debug("Getting commands for Fan...");
        if (isDiy) {
            this.log.debug("Getting commands for DIY Fan...");
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost + `/v2.0/infrareds/${this.parentId}/remotes/${this.deviceId}/learning-codes`, "GET", {}, (codesBody) => {
                if (codesBody.success) {
                    this.log.debug("Received codes. Returning all available codes");
                    this.getDIYIRCodesFromAPIResponse(codesBody);
                } else {
                    this.log.error("Failed to get codes for DIY Fan", codesBody.msg);
                }
            });
        } else {
            this.log.debug("Getting standard keys");
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${this.deviceId}/keys`, 'GET', {}, (body) => {
                if (body.success) {
                    this.getStandardIRCodesFromAPIResponse(body);
                    this.categoryId = body.result.category_id;
                    this.log.debug("Getting DIY keys, if any");
                    APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost + `/v2.0/infrareds/${this.parentId}/remotes/${this.deviceId}/learning-codes`, "GET", {}, (codesBody) => {
                        if (codesBody.success) {
                            this.log.debug("Received codes. Returning all available codes");
                            this.getDIYIRCodesFromAPIResponse(codesBody);
                        } else {
                            this.log.error("Failed to get codes for DIY Fan", codesBody.msg);
                        }
                    });
                } else {
                    this.log.error("Failed to get fan key details", body.msg);
                }
            });
        }
    }

    private sendFanCommand(command: Command, cb) {
        const commandObj = {}
        if (command.isDIY) {
            commandObj["code"] = command.key.name
        }
        else {
            commandObj["category_id"] = this.categoryId
            commandObj["key"] = command.key.name
            commandObj["key_id"] = command.key.id
        }

        const sendCommandAPIURL = command.isDIY ? `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${this.deviceId}/learning-codes` : `${this.configuration.apiHost}/v2.0/infrareds/${this.parentId}/remotes/${this.deviceId}/raw/command`;

        APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, sendCommandAPIURL, "POST", commandObj, (body) => {
            cb(body);
        });
    }

    private getIRCodeFromKey(item, key: string) {
        if (item.key_name === key) {
            if (item.key_id != undefined)
                return {key_id: item.key_id, key: item.key};
            else
                return {key_id: item.id, key: item.code}
        }
        return {key_id: -1}
    }

    private getDIYIRCodesFromAPIResponse(apiResponse) {
        for (let i = 0; i < apiResponse.result.length; i++) {
            const codeItem = apiResponse.result[i];
            this.process_commands(codeItem, true);
        }
    }

    private getStandardIRCodesFromAPIResponse(apiResponse) {
        for (let i = 0; i < apiResponse.result.key_list.length; i++) {
            const codeItem = apiResponse.result.key_list[i];
            this.process_commands(codeItem, false);
        }
    }

    private process_commands(codeItem, isDIY) {
        let key = this.getIRCodeFromKey(codeItem, "power");
        if (key.key_id != -1)
            this.powerCommand = new Command(key, isDIY);

        key = this.getIRCodeFromKey(codeItem, "swing");
        if (key.key_id != -1)
            this.swingCommand = new Command(key, isDIY);
        
        key = this.getIRCodeFromKey(codeItem, "speed_up");
        if (key.key_id != -1)
            this.speedUpCommand = new Command(key, isDIY);
        
        key = this.getIRCodeFromKey(codeItem, "speed_down");
        if (key.key_id != -1)
            this.speedDownCommand = new Command(key, isDIY);

        key = this.getIRCodeFromKey(codeItem, "vertical_swing");
        if (key.key_id != -1)
            this.verticalSwingCommand = new Command(key, isDIY);
    }
}
