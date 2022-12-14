const axios = require('axios');
const Color = require('color');

const wait = async (timeToDelay) => new Promise((resolve) => setTimeout(resolve, timeToDelay));

module.exports = (api) => {
    api.registerAccessory('homebridge-hyperion-service', 'Hyperion', Hyperion);
}

const LEDDEVICE = 'LEDDEVICE'

class Hyperion {
    constructor(log, config, api) {
        this.log = log;
        this.config = config;
        this.api = api;

        this.name = config.name || "Hyperion";
        this.port = config.port || 8090;
        this.priority = config.priority || 100;
        this.url = `${config.url}:${this.port}/json-rpc`;
        this.color = Color([255, 200, 150])

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;

        this.service = new this.Service.Lightbulb(this.name);

        this.service.getCharacteristic(this.Characteristic.On)
            .onGet(this.handleOnGet.bind(this))
            .onSet(this.handleOnSet.bind(this));

        this.service.addCharacteristic(this.Characteristic.Brightness)
            .onGet(this.handleBrightnessGet.bind(this))
            .onSet(this.handleBrightnessSet.bind(this));

        this.service
            .addCharacteristic(this.Characteristic.Hue)
            .onSet(this.handleHueSet.bind(this))
            .onGet(this.handleHueGet.bind(this));

        this.service
            .addCharacteristic(this.Characteristic.Saturation)
            .onSet(this.handleSaturationSet.bind(this))
            .onGet(this.handleSaturationGet.bind(this));

        this.log.info(`Hyperion Service Started: ${this.name}`)
    }

    async handleOnGet() {
        this.log.debug('Triggered GET On');
        const { url } = this;

        const { data } = await axios.post(url, { command: "serverinfo" });
        const status = data.info.components.find((component) => component.name === LEDDEVICE)?.enabled;

        return Boolean(status)
            ? 1
            : 0;
    }

    async handleOnSet(value) {
        this.log.debug('Triggered SET On:', value);
        const { url } = this;

        const { data } = await axios.post(url, {
            command: "componentstate",
            componentstate: {
                component: LEDDEVICE,
                state: value
            }
        });
        const { success } = data;

        if (!success) {
            this.log.error(`Failed to set the state to: ${value}`);
        }
    }

    async handleBrightnessGet() {
        this.log.debug('Triggered GET On');
        const { url } = this;

        const { data } = await axios.post(url, { "command": "serverinfo" });
        const { brightness } = data.info.adjustment[0];

        this.service.getCharacteristic(this.Characteristic.Brightness).updateValue(brightness ?? 0);
    }

    async handleBrightnessSet(value) {
        const { url } = this;

        const { data } = await axios.post(url, {
            command: "adjustment",
            adjustment: {
                brightness: value
            }
        });
        const { success } = data;

        if (!success) {
            this.log.error(`Failed to set the brightness to: ${value}`);
        }

        this.service.getCharacteristic(this.Characteristic.Brightness).updateValue(value);
    }

    async handleHueSet(value) {
        const newHue = Color(this.color).hue(value);
        this.color = newHue;

        this.log.debug(`Setting hue to: ${value}`)

        this.log.debug(`Successfully set the hue.`)

        return this.color.hue();
    }

    async handleHueGet() {
        return this.color.hue();
    }

    async handleSaturationGet() {
        return this.color.saturationv()
    }

    async handleSaturationSet(level) {
        await wait(100);
        const { url, priority } = this;
        const newColor = Color(this.color).saturationv(level);

        this.log.debug(`Setting saturation to: ${level}`)

        const { data } = await axios.post(url, {
            command: "color",
            priority,
            color: newColor.rgb().round().array()
        });

        const { success } = data;

        if (!success) {
            this.log.error(`Failed to set the saturation to: ${level}`);
        } else {
            this.log.debug(`Successfully set the saturation. New color ${newColor.rgb().round().array()}`)
            this.color.hue(newColor.hue());
        }
    }

    getServices() {
        return [
            this.service,
        ];
    }
}