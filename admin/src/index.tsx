import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Tabs } from 'iobroker-react-components';
import { Settings } from './pages/settings';
import { OnSettingsChangedCallback } from './lib/common';
import { I2CAdapterConfig } from '../../src/lib/shared';
import { General } from './pages/general';

// layout components
interface RootProps {
    settings: I2CAdapterConfig;
    onSettingsChanged: OnSettingsChangedCallback;
}

export function Root(props: RootProps): JSX.Element {
    // Subscribe and unsubscribe from states and objects
    function onUnload(): void {
        console.log('onUnload');
    }

    React.useEffect(() => {
        return onUnload;
    }, []);

    return (
        <Tabs labels={['General', 'Settings']}>
            <General settings={props.settings} onChange={props.onSettingsChanged} />
            <Settings settings={props.settings} onChange={props.onSettingsChanged} />
        </Tabs>
    );
}

let curSettings: I2CAdapterConfig;
let originalSettings: I2CAdapterConfig;

/**
 * Checks if any setting was changed
 */
function hasChanges(): boolean {
    if (Object.keys(originalSettings).length !== Object.keys(curSettings).length) return true;
    for (const key of Object.keys(originalSettings)) {
        if (originalSettings[key] !== curSettings[key]) return true;
    }
    return false;
}

// the function loadSettings has to exist ...
(window as any).load = (settings: I2CAdapterConfig, onChange: (hasChanges: boolean) => void) => {
    originalSettings = settings;

    const settingsChanged: OnSettingsChangedCallback = (newSettings) => {
        curSettings = newSettings;
        onChange(hasChanges());
    };

    ReactDOM.render(
        <Root settings={settings} onSettingsChanged={settingsChanged} />,
        document.getElementById('adapter-container'),
    );

    // Signal to admin, that no changes yet
    onChange(false);
};

// ... and the function save has to exist.
// you have to make sure the callback is called with the settings object as first param!
(window as any).save = (callback: (newSettings: I2CAdapterConfig) => void) => {
    // save the settings
    callback(curSettings);
    originalSettings = curSettings;
};
