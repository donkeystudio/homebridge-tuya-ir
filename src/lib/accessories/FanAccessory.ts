import { Service, PlatformAccessory, CharacteristicValue } from 'homebridge';
import { TuyaIRPlatform } from '../../platform';
import { BaseAccessory } from './BaseAccessory';
import { APIInvocationHelper } from '../api/APIInvocationHelper';

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
    private sendCommandAPIURL: string;
    private sendCommandKey: string;

    private fanStates = {
        On: false,
        swing: false,
        speedBeingChanged: false,
        verticalSwing: false
    };

    private powerCommand: number = 1;
    private speedUpCommand: number = 9367;
    private speedDownCommand: number = 9367;
    private swingCommand: number = 9372;
    private verticalSwingCommand: number = 9372;
    private swingSave: boolean = false;
    private hasVSwing: boolean = false;
    private swingPower:boolean = false;

    constructor(
        private readonly platform: TuyaIRPlatform,
        private readonly accessory: PlatformAccessory,
    ) {
        super(platform, accessory);
        this.sendCommandAPIURL = accessory.context.device.diy ? `${this.configuration.apiHost}/v1.0/infrareds/${this.parentId}/remotes/${accessory.context.device.id}/learning-codes` : `${this.configuration.apiHost}/v1.0/infrareds/${this.parentId}/remotes/${accessory.context.device.id}/raw/command`;
        this.sendCommandKey = accessory.context.device.diy ? 'code' : 'raw_key';

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
            
        this.getFanCommands(this.parentId, accessory.context.device.id, accessory.context.device.diy, (commands) => {
            if (commands) {
                this.powerCommand 	  		= commands.power;
                this.speedUpCommand   		= commands.speedUp;
                this.speedDownCommand 		= commands.speedDown;
                this.swingCommand 	  		= commands.swing;
                this.verticalSwingCommand 	= commands.vSwing;
            } else {
                this.platform.log.warn(`Failed to get commands for the fan. Defaulting to standard values. These may not work.`);
            }
        })
    }

    setup(platform: TuyaIRPlatform, accessory: PlatformAccessory) {

        
    }

    async setOn(value: CharacteristicValue) 
    {
        var command = this.powerCommand;

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

    	var command  = this.speedUpCommand;

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

    	var command  = this.speedDownCommand;

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
			var command = this.verticalSwingCommand;

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

    private getFanCommands(irDeviceId: string, remoteId: string, isDiy = false, callback) {
        this.log.debug("Getting commands for Fan...");
        if (isDiy) {
            this.log.debug("Getting commands for DIY Fan...");
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost + `/v1.0/infrareds/${irDeviceId}/remotes/${remoteId}/learning-codes`, "GET", {}, (codesBody) => {
                if (codesBody.success) {
                    this.log.debug("Received codes. Returning all available codes");
                    callback(this.getIRCodesFromAPIResponse(codesBody));
                } else {
                    this.log.error("Failed to get codes for DIY Fan", codesBody.msg);
                    callback();
                }
            });
        } else {
            this.log.debug("First getting brand id and remote id for given device...");
            APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, `${this.configuration.apiHost}/v1.0/infrareds/${irDeviceId}/remotes/${remoteId}/keys`, 'GET', {}, (body) => {
                if (body.success) {
                    this.log.debug(`Found category id: ${body.result.category_id}, brand id: ${body.result.brand_id}, remote id: ${body.result.remote_index}`);
                    APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.configuration.apiHost + `/v1.0/infrareds/${irDeviceId}/categories/${body.result.category_id}/brands/${body.result.brand_id}/remotes/${body.result.remote_index}/rules`, "GET", {}, (codesBody) => {
                        if (codesBody.success) {
                            this.log.debug("Received codes. Returning all available codes");
                            callback(this.getIRCodesFromAPIResponse(codesBody));
                        } else {
                            this.log.warn("Failed to get custom codes for fan. Trying to use standard codes...", codesBody.msg);
                            callback(this.getStandardIRCodesFromAPIResponse(body));
                        }
                    });
                } else {
                    this.log.error("Failed to get fan key details", body.msg);
                    callback();
                }
            });
        }
    }

    private sendFanCommand(command: string | number, cb) {
        const commandObj = { [this.sendCommandKey]: command };
        APIInvocationHelper.invokeTuyaIrApi(this.log, this.configuration, this.sendCommandAPIURL, "POST", commandObj, (body) => {
            cb(body);
        });
    }

    private getIRCodeFromKey(item, key: string) {
        if (item.key_name === key) {
            return item.key_id || item.key;
        }
    }

    private getIRCodesFromAPIResponse(apiResponse) {
        const ret = { power: null, speedUp: null, swing: null, speedDown: null, vSwing: null };
        for (let i = 0; i < apiResponse.result.length; i++) {
            const codeItem = apiResponse.result[i];
            ret.power       = ret.power || this.getIRCodeFromKey(codeItem, "power");
            ret.swing       = ret.swing || this.getIRCodeFromKey(codeItem, "swing");
            ret.speedUp     = ret.speedUp || this.getIRCodeFromKey(codeItem, "speed_up");
            ret.speedDown   = ret.speedDown || this.getIRCodeFromKey(codeItem, "speed_down");
            ret.vSwing      = ret.vSwing || this.getIRCodeFromKey(codeItem, "vertical_swing");
        }
        return ret;
    }

    private getStandardIRCodesFromAPIResponse(apiResponse) {
        const ret = { power: null, speedUp: null, swing: null, speedDown: null, vSwing: null };
        for (let i = 0; i < apiResponse.result.key_list.length; i++) {
            const codeItem = apiResponse.result.key_list[i];
            ret.power       = ret.power || this.getIRCodeFromKey(codeItem, "power");
            ret.swing       = ret.swing || this.getIRCodeFromKey(codeItem, "swing");
            ret.speedUp     = ret.speedUp || this.getIRCodeFromKey(codeItem, "speed_up");
            ret.speedDown   = ret.speedDown || this.getIRCodeFromKey(codeItem, "speed_down");
            ret.vSwing      = ret.vSwing || this.getIRCodeFromKey(codeItem, "vertical_swing");
        }
        return ret;
    }
}
