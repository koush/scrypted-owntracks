// https://developer.scrypted.app/#getting-started
import sdk, { HttpRequestHandler, Settings, DeviceProvider, ScryptedDeviceType, OccupancySensor, Setting, HttpRequest, HttpResponse, PasswordStore } from "@scrypted/sdk";
import { ScryptedDeviceBase } from "@scrypted/sdk";
const { log, deviceManager, systemManager } = sdk;
import auth from 'basic-auth';

log.i('Hello World. This will create a virtual OnOff device.');

class OwntracksRegion extends ScryptedDeviceBase implements OccupancySensor, Settings {
    getSetting(key: string): string | number | boolean {
        return null;
    }
    getSettings(): Setting[] {
        var ret: Setting[] = [];
        for (var i = 0; i < this.storage.length; i++) {
            var key = this.storage.key(i);
            ret.push({
                key,
                value: key,
                title: 'Owntracks Username',
                description: 'This sensor will be marked as occupied if this user is in this Owntracks region.',
            })
        }
        ret.push({
            title: 'Add User',
            placeholder: 'username',
            description: 'Owntracks Username',
            key: 'new-user',
        })
        return ret;
    }
    putSetting(key: string, value: string | number | boolean): void {
        if (key == 'new-user') {
            this.storage.setItem(value as string, false.toString());
            return;
        }
        this.storage.removeItem(key);
        if ((value as string).length) {
            this.storage.setItem(value as string, false.toString());
        }
        this.sendOccupancyEvent();
    }
    sendOccupancyEvent() {
        for (var i = 0; i < this.storage.length; i++) {
            var key = this.storage.key(i);
            if (this.storage.getItem(key) === 'true') {
                this.occupied = true;
                return;
            }
        }
        this.occupied = false;
    }
    constructor(nativeId: string) {
        super(nativeId);
    }
}

class Owntracks extends ScryptedDeviceBase implements HttpRequestHandler, Settings, DeviceProvider, PasswordStore {
    constructor() {
        super();
        this.passwords = this.getPasswords();
        if (!localStorage.getItem('private_http')) {
            setImmediate(() => {
                systemManager.getPublicCloudEndpoint().then(endpoint => {
                    localStorage.setItem('private_http', endpoint);
                });
                log.a('The Owntracks Private HTTP endpoint is available in Settings.');
            });
        }
    }
    getPasswords(): string[] {
        try {
            return JSON.parse(localStorage.getItem('passwords')) || [];
        }
        catch (e) {
            return [];
        }
    }
    savePasswords(passwords: string[]) {
        var uniques = {};
        passwords.map(password => uniques[password] = true);
        passwords = Object.keys(uniques);
        localStorage.setItem('passwords', JSON.stringify(passwords));
        this.passwords = passwords;
    }
    addPassword(password: string): void {
        var passwords = this.getPasswords();
        passwords.push(password)
        this.savePasswords(passwords);
    }
    removePassword(password: string): void {
        var passwords = this.getPasswords();
        passwords.filter(entry => entry != password);
        this.savePasswords(passwords);
    }
    checkPassword(password: string): boolean {
        return this.getPasswords().includes(password);
    }
    discoverDevices(duration: number): void {
    }
    getDevice(nativeId: string): object {
        return new OwntracksRegion(nativeId);
    }
    getSetting(key: string): string | number | boolean {
        return null;
    }
    getSettings(): Setting[] {
        return [
            {
                key: 'private_http',
                title: 'Private HTTP',
                description: 'The Private HTTP endpoint that is configured within the Owntracks mobile application. Owntracks users will need to authenticate with one of the passcodes set up by this Plugin.',
                readonly: true,
                value: localStorage.getItem('private_http') || 'Error creating Private HTTP. Try reloading the plugin',
            },
            {
                key: 'region',
                description: 'The name of the Region within Owntracks. Multiple users may specifiy the same Region. The OccupancySensor will be marked as occupied when any of them are within that Region.',
                title: 'Add Owntracks Region',
            },
        ];
    }
    putSetting(key: string, value: string | number | boolean): void {
        deviceManager.onDeviceDiscovered({
            name: value.toString(),
            interfaces: ['OccupancySensor', 'Settings'],
            nativeId: value.toString(),
            type: ScryptedDeviceType.Sensor,
        });
    }
    getEndpoint(): string {
        return "@scrypted/owntracks";
    }
    onRequest(request: HttpRequest, response: HttpResponse): void {
        if (request.isPublicEndpoint) {
            systemManager.getPublicCloudEndpoint().then(endpoint => {
                response.send('Owntracks is running!\nSet up a Region within the Scrypted plugin!');
            });
            return;
        }
        var user = auth.parse(request.headers['authorization']);
        if (!this.getPasswords().includes(user.pass)) {
            response.send({
                code: 401,
            }, 'Bad Auth');
            return;
        }
        const body = JSON.parse(request.body);

        for (var nativeId of deviceManager.getNativeIds()) {
            let region = new OwntracksRegion(nativeId);
            let value = region.storage.getItem(user.name);
            if (value !== null) {
                region.storage.setItem(user.name, body.inregions && body.inregions.includes(nativeId) ? 'true': 'false');
                region.sendOccupancyEvent();
            }
        }
        // Owntracks user needs to create a region named Scrypted, and when this is/isn't detected, fire an event.
        response.send('ok');
    }
}

export default new Owntracks();
