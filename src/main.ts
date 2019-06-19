// https://developer.scrypted.app/#getting-started
import sdk, { HttpRequestHandler, Settings, DeviceProvider, ScryptedDeviceType, OccupancySensor } from "@scrypted/sdk";
import { ScryptedDeviceBase } from "@scrypted/sdk";
const { log, deviceManager, systemManager } = sdk;
import querystring from 'querystring';

log.i('Hello World. This will create a virtual OnOff device.');

class Tracker extends ScryptedDeviceBase implements OccupancySensor {
    constructor(nativeId: string) {
        super(nativeId);
    }
}

class Owntracks extends ScryptedDeviceBase implements HttpRequestHandler, Settings, DeviceProvider {
    discoverDevices(duration: number): void {
    }
    getDevice(nativeId: string): object {
        return new Tracker(nativeId);
    }
    getSetting(key: string): string | number | boolean {
        return null;
    }
    getSettings(): import("@scrypted/sdk").Setting[] {
        return [
            {
                key: 'user',
                description: 'The friendly/full name of the user',
                title: 'Display Name of Owntracks User',
            }
        ]
    }
    putSetting(key: string, value: string | number | boolean): void {
        const owntracksKey = Math.random().toString();
        localStorage.setItem(value as string, owntracksKey);
        deviceManager.onDeviceDiscovered({
            name: value.toString(),
            interfaces: ['OccupancySensor'],
            nativeId: value.toString(),
            type: ScryptedDeviceType.Sensor,
        });

        systemManager.getPublicCloudEndpoint().then(endpoint => {
            log.a(`New user created. Create a Owntracks region named "Scrypted". Private HTTP: ${endpoint}&owntracksId=${value}&owntracksKey=${owntracksKey}`);
        });
    }
    getEndpoint(): string {
        return "@scrypted/owntracks";
    }
    onRequest(request: import("@scrypted/sdk").HttpRequest, response: import("@scrypted/sdk").HttpResponse): void {
        const body = JSON.parse(request.body);
        const { owntracksId, owntracksKey } = querystring.parse(request.url);
        if (localStorage.getItem(owntracksId as string) !== owntracksKey) {
            response.send({
                code: 401
            }, 'Bad auth');
            return;
        }
        // Owntracks user needs to create a region named Scrypted, and when this is/isn't detected, fire an event.
        deviceManager.onDeviceEvent(owntracksId as string, 'OccupancySensor', (body.inregions && body.inregions.includes('Scrypted')));
        response.send('ok');
    }
}

export default new Owntracks();
