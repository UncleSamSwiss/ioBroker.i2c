import * as React from 'react';
import * as ReactDOM from 'react-dom';

import { Tabs } from 'iobroker-react-components';
import { Settings, OnSettingsChangedCallback } from './pages/settings';

// layout components
interface RootProps {
    settings: Record<string, unknown>;
    onSettingsChanged: OnSettingsChangedCallback;
}

export function Root(props: RootProps): React.SFCElement<any> {
    // Subscribe and unsubscribe from states and objects
    function onUnload(): void {
        console.log('onUnload');
    }

    React.useEffect(() => {
        return onUnload;
    }, []);

    return (
        <Tabs labels={['Settings A', 'Settings B']}>
            <Settings settings={props.settings} onChange={props.onSettingsChanged} />
            <Settings settings={props.settings} onChange={props.onSettingsChanged} />
        </Tabs>
    );
}

let curSettings: Record<string, unknown>;
let originalSettings: Record<string, unknown>;

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
(window as any).load = (settings: Record<string, unknown>, onChange: (hasChanges: boolean) => void) => {
    originalSettings = settings;

    const settingsChanged: OnSettingsChangedCallback = (newSettings) => {
        curSettings = newSettings;
        onChange(hasChanges());
    };

    ReactDOM.render(
        <Root settings={settings} onSettingsChanged={settingsChanged} />,
        document.getElementById('adapter-container') || document.getElementsByClassName('adapter-container')[0],
    );

    // Signal to admin, that no changes yet
    onChange(false);
};

// ... and the function save has to exist.
// you have to make sure the callback is called with the settings object as first param!
(window as any).save = (callback: (newSettings: Record<string, unknown>) => void) => {
    // save the settings
    callback(curSettings);
    originalSettings = curSettings;
};
