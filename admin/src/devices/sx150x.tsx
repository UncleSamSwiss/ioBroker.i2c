import SelectID from '@iobroker/adapter-react/Dialogs/SelectID';
import I18n from '@iobroker/adapter-react/i18n';
import Button from '@material-ui/core/Button';
import Checkbox from '@material-ui/core/Checkbox';
import FormControl from '@material-ui/core/FormControl';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormHelperText from '@material-ui/core/FormHelperText';
import Grid from '@material-ui/core/Grid';
import InputAdornment from '@material-ui/core/InputAdornment';
import TextField from '@material-ui/core/TextField';
import AddCircleOutlineIcon from '@material-ui/icons/AddCircleOutline';
import { boundMethod } from 'autobind-decorator';
import React from 'react';
import { KeypadConfig, LedConfig, PinConfig, PinMode, SX150xConfig } from '../../../src/devices/sx150x';
import Dropdown, { DropdownOption } from '../components/dropdown';
import ToggleSwitch from '../components/toggle-switch';
import { DeviceBase, DeviceProps } from './device-base';
import { DeviceInfo } from './device-factory';

interface PinCapabilities {
    levelShift: boolean;
    blink: boolean;
    breath: boolean;
}

interface SX150xExtra {
    hasKeypad: boolean; // difference between SX1507 and SX1508/9
    hasHighInput: boolean;
    hasAutoSleep: boolean;
    showLed: boolean;
    showKeypad: boolean;
    showDebounce: boolean;
    showIdDialog: boolean;

    caps: PinCapabilities[];
}

class SX150x extends DeviceBase<SX150xConfig, SX150xExtra> {
    private readonly pinCount: number;

    private readonly oscFrequencyOptions: DropdownOption[] = [
        { value: '0', title: I18n.t('Off') },
        { value: '1', title: '2 MHz' },
        { value: '2', title: '1 MHz' },
        { value: '3', title: '500 kHz' },
        { value: '4', title: '250 kHz' },
        { value: '5', title: '125 kHz' },
        { value: '6', title: '62.5 kHz' },
        { value: '7', title: '~31.3 kHz' },
        { value: '8', title: '~15.6 kHz' },
        { value: '9', title: '~7.8 kHz' },
        { value: '10', title: '~3.9 kHz' },
        { value: '11', title: '~2 kHz' },
        { value: '12', title: '~977 Hz' },
        { value: '13', title: '~488 Hz' },
        { value: '14', title: '~244 Hz' },
    ];

    private readonly ledFrequencyOptions: DropdownOption[] = [
        { value: '1', title: '2 MHz' },
        { value: '2', title: '1 MHz' },
        { value: '3', title: '500 kHz' },
        { value: '4', title: '250 kHz' },
        { value: '5', title: '125 kHz' },
        { value: '6', title: '62.5 kHz' },
        { value: '7', title: '31.25 kHz' },
    ];

    private readonly debounceTimeOptions: DropdownOption[] = [
        { value: '0', title: '0.5 ms' },
        { value: '1', title: '1 ms' },
        { value: '2', title: '2 ms' },
        { value: '3', title: '4 ms' },
        { value: '4', title: '8 ms' },
        { value: '5', title: '16 ms' },
        { value: '6', title: '32 ms' },
        { value: '7', title: '64 ms' },
    ];

    private readonly keyRowsOptions: DropdownOption[] = [{ value: '0', title: I18n.t('Off') }];

    private readonly keyColsOptions: DropdownOption[] = [{ value: '0', title: '1' }];

    private readonly keyAutoSleepOptions: DropdownOption[] = [
        { value: '0', title: I18n.t('Off') },
        { value: '1', title: '128 ms' },
        { value: '2', title: '256 ms' },
        { value: '3', title: '512 ms' },
        { value: '4', title: '1 sec' },
        { value: '5', title: '2 sec' },
        { value: '6', title: '4 sec' },
        { value: '7', title: '8 sec' },
    ];

    private readonly resistorOptions: DropdownOption[] = [
        { value: 'none', title: I18n.t('None') },
        { value: 'up', title: I18n.t('Pull-up') },
        { value: 'down', title: I18n.t('Pull-down') },
    ];

    private readonly interruptOptions: DropdownOption[] = [
        { value: 'none', title: I18n.t('None') },
        { value: 'raising', title: I18n.t('Raising') },
        { value: 'falling', title: I18n.t('Falling') },
        { value: 'both', title: I18n.t('Both') },
    ];

    private readonly ledIntensityOffOptions: DropdownOption[] = [];

    constructor(props: DeviceProps<SX150xConfig>) {
        super(props);

        const caps: PinCapabilities[] = [];

        switch (props.baseConfig.name) {
            case 'SX1507':
                this.pinCount = 4;
                for (let i = 0; i < 4; i++) {
                    caps[i] = { levelShift: false, blink: true, breath: i > 0 };
                }
                break;
            case 'SX1508':
                this.pinCount = 8;
                for (let i = 0; i < 8; i++) {
                    caps[i] = { levelShift: i < 4, blink: (i >> 1) % 2 === 1, breath: i % 4 === 3 };
                }
                break;
            default:
                this.pinCount = 16;
                for (let i = 0; i < 16; i++) {
                    caps[i] = { levelShift: i < 8, blink: true, breath: (i >> 2) % 2 === 1 };
                }
                break;
        }

        let config: SX150xConfig;
        if (!props.config || props.config.pins.length !== this.pinCount) {
            config = {
                pollingInterval: 200,
                oscExternal: false,
                oscFrequency: 0,
                ledLog: [],
                ledFrequency: 1, // 0 is not a choice because then LEDs are off
                debounceTime: 0,
                keypad: {
                    rowCount: 0,
                    columnCount: 0,
                    autoSleep: 0,
                    scanTime: 0,
                    keyValues: [],
                },

                pins: [],
            };

            config.ledLog[0] = false;

            if (this.pinCount > 4) {
                config.ledLog[1] = false;

                for (let r = 0; r < this.pinCount / 2; r++) {
                    config.keypad.keyValues[r] = [];
                    for (let c = 0; c < this.pinCount / 2; c++) {
                        config.keypad.keyValues[r][c] = String.fromCharCode(65 + c) + r;
                    }
                }
            }

            for (let i = 0; i < this.pinCount; i++) {
                const led: LedConfig = {
                    timeOn: 1, // 0 is not a choice because then the LED is static
                    intensityOn: 0xff,
                    timeOff: 1, // 0 is not a choice because then the LED is single-shot
                    intensityOff: 0,
                    timeRaise: 0,
                    timeFall: 0,
                };
                config.pins[i] = {
                    mode: 'none',
                    resistor: 'none',
                    openDrain: false,
                    invert: false,
                    debounce: false,
                    interrupt: 'none',
                    highInput: false,
                    levelShifterMode: 'AtoB',
                    led,
                };
            }

            props.onChange(config);
        } else {
            config = { ...props.config };
        }
        config.interrupt = config.interrupt || '';

        const extra: SX150xExtra = {
            hasKeypad: this.pinCount > 4,
            hasHighInput: this.pinCount > 4,
            hasAutoSleep: this.pinCount == 16,
            showLed: this.hasLedPins(config),
            showKeypad: this.hasKeypadPins(config),
            showDebounce: this.hasDebouncedPins(config),
            showIdDialog: false,
            caps,
        };

        console.log('new SX150x()', props, config, extra);
        this.state = { config: config, extra: extra };

        for (let i = 1; i < this.pinCount / 2; i++) {
            const option = { value: i.toString(), title: (i + 1).toString() };
            this.keyRowsOptions.push(option);
            this.keyColsOptions.push({ ...option });
        }

        for (let i = 0; i < 8; i++) {
            this.ledIntensityOffOptions.push({ value: i.toString(), title: (i * 4).toString() });
        }
    }

    private hasLedPins(config: Readonly<SX150xConfig>): boolean {
        return !!config.pins.find((p) => p.mode.startsWith('led-'));
    }

    private hasKeypadPins(config: Readonly<SX150xConfig>): boolean {
        return this.pinCount > 4 && config.keypad.rowCount > 0;
    }

    private hasDebouncedPins(config: Readonly<SX150xConfig>): boolean {
        return config.keypad.rowCount > 0 || !!config.pins.find((p) => p.mode === 'input' && p.debounce);
    }

    @boundMethod
    protected onExtraChange(event: React.FormEvent<HTMLElement>, checked: boolean): boolean {
        const target = event.target as HTMLInputElement | HTMLSelectElement; // TODO: more types
        const id = target.id || target.name;
        const extra = { [id]: checked };
        this.setExtraState(extra);
        return false;
    }

    @boundMethod
    protected onLedLogChange(index: number, value: boolean): void {
        const ledLog = [...this.state.config.ledLog];
        ledLog[index] = value;
        this.doHandleChange('ledLog', ledLog);
    }

    @boundMethod
    protected selectInterruptId(): void {
        this.setExtraState({ showIdDialog: true });
    }

    @boundMethod
    protected onPinChange<K extends keyof PinConfig>(index: number, key: K, value: PinConfig[K]): void {
        const bankB = index + this.pinCount / 2;
        const pins = [...this.state.config.pins];
        const pin = pins[index];
        if (
            key === 'mode' &&
            (value === 'level-shifter' || pin.mode === 'level-shifter') &&
            index < this.pinCount / 2
        ) {
            pins[bankB] = { ...pins[bankB], mode: value === 'level-shifter' ? 'level-shifter' : 'none' };
        } else if (key === 'levelShifterMode' && index < this.pinCount / 2) {
            pins[bankB] = { ...pins[bankB], levelShifterMode: value as any };
        }

        pins[index] = { ...pin, [key]: value };

        this.doHandleChange('pins', pins);
    }

    @boundMethod
    protected onPinLedChange<K extends keyof LedConfig>(index: number, key: K, value: LedConfig[K]): void {
        const pin = this.state.config.pins[index];
        const led = { ...pin.led, [key]: value };
        this.onPinChange(index, 'led', led);
    }

    private onInterruptSelected(selected?: string) {
        this.setExtraState({ showIdDialog: false });
        if (selected) {
            this.doHandleChange('interrupt', selected);
        }
    }

    @boundMethod
    protected onDebounceTimeChange(value: string): void {
        const debounceTime = parseInt(value);
        this.doHandleChange('debounceTime', debounceTime, () => {
            if (debounceTime > this.state.config.keypad.scanTime) {
                // the scan time is no longer valid as it would be below the debounce time, update it
                this.onKeypadChange('scanTime', debounceTime);
            }
        });
    }

    private onKeypadChange<K extends keyof KeypadConfig>(key: K, value: KeypadConfig[K]) {
        const keypad = { ...this.state.config.keypad, [key]: value };
        this.doHandleChange('keypad', keypad, () => {
            if (key != 'rowCount' && key != 'columnCount') {
                return;
            }
            let rowCount = this.state.config.keypad.rowCount;
            let columnCount = this.state.config.keypad.columnCount;
            if (rowCount === 0) {
                rowCount = -1;
                columnCount = -1;
            }

            const pins = [...this.state.config.pins];
            const bankSize = this.pinCount / 2;
            for (let i = 0; i < bankSize; i++) {
                if (i <= rowCount) {
                    if (pins[i].mode == 'level-shifter') {
                        // if bank A was level shifter, bank B should also no longer be level shifter
                        pins[i + bankSize].mode = 'none';
                    }
                    pins[i] = { ...pins[i], mode: 'keypad' };
                } else if (pins[i].mode == 'keypad') {
                    pins[i] = { ...pins[i], mode: 'none' };
                }
            }

            for (let i = 0; i < bankSize; i++) {
                if (i <= columnCount) {
                    if (pins[i].mode == 'level-shifter') {
                        // if bank A was level shifter, it can no longer be level shifter
                        pins[i].mode = 'none';
                    }
                    pins[i + bankSize] = { ...pins[i + bankSize], mode: 'keypad' };
                } else if (pins[i + bankSize].mode == 'keypad') {
                    pins[i + bankSize] = { ...pins[i + bankSize], mode: 'none' };
                }
            }

            this.doHandleChange('pins', pins);
        });
    }

    @boundMethod
    private handleKeyValueChange(event: React.ChangeEvent<HTMLInputElement>) {
        const parts = event.target.name.split('-');
        const value = event.target.value;
        const keyValues = [...this.state.config.keypad.keyValues];
        keyValues[parseInt(parts[1])][parseInt(parts[2])] = value;
        this.onKeypadChange('keyValues', keyValues);
    }

    private getKeyScanTimeOptions(): DropdownOption[] {
        const options: DropdownOption[] = [];
        for (let i = 0; i < 8; i++) {
            options.push({ value: i.toString(), title: `${1 << i} ms`, disabled: i < this.state.config.debounceTime });
        }
        return options;
    }

    public render(): React.ReactNode {
        const config = this.state.config;
        const extra = this.state.extra;
        if (!extra) {
            return;
        }
        return (
            <>
                {extra.showIdDialog && (
                    <SelectID
                        socket={this.props.context.socket}
                        notEditable={false}
                        selected={config.interrupt}
                        onClose={() => this.onInterruptSelected()}
                        onOk={(selected) => this.onInterruptSelected(selected as string)}
                    ></SelectID>
                )}
                <Grid container spacing={3}>
                    <Grid item xs={7} sm={5} md={3}>
                        <TextField
                            name="pollingInterval"
                            label={I18n.t('Polling Interval')}
                            value={config.pollingInterval}
                            type="number"
                            InputProps={{
                                endAdornment: <InputAdornment position="end">ms</InputAdornment>,
                            }}
                            fullWidth
                            onChange={this.handleChange}
                        />
                    </Grid>
                </Grid>
                <Grid container spacing={3}>
                    <Grid item xs={9} md={6}>
                        <TextField
                            name="interrupt"
                            label={I18n.t('Interrupt object')}
                            value={config.interrupt}
                            type="text"
                            fullWidth
                            onChange={this.handleChange}
                        />
                    </Grid>
                    <Grid item xs={3} md={6}>
                        <Button variant="contained" onClick={this.selectInterruptId} style={{ marginTop: '22px' }}>
                            <AddCircleOutlineIcon />
                        </Button>
                    </Grid>
                </Grid>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <FormControl style={{ marginTop: -5 }} fullWidth>
                            <FormHelperText>{I18n.t('features')}</FormHelperText>
                            <div>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={extra.showLed}
                                            onChange={this.onExtraChange}
                                            name="showLed"
                                            disabled={extra.showLed && this.hasLedPins(config)}
                                        />
                                    }
                                    label={I18n.t('showLed')}
                                />
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            checked={extra.showDebounce || extra.showKeypad}
                                            onChange={this.onExtraChange}
                                            name="showDebounce"
                                            disabled={
                                                extra.showKeypad ||
                                                (extra.showDebounce && this.hasDebouncedPins(config))
                                            }
                                        />
                                    }
                                    label={I18n.t('showDebounce')}
                                />
                                {extra.hasKeypad && (
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                checked={extra.showKeypad}
                                                onChange={this.onExtraChange}
                                                name="showKeypad"
                                                disabled={extra.showKeypad && this.hasKeypadPins(config)}
                                            />
                                        }
                                        label={I18n.t('showKeypad')}
                                    />
                                )}
                            </div>
                        </FormControl>
                    </Grid>
                </Grid>
                {(extra.showLed || extra.showDebounce || extra.showKeypad) && (
                    <Grid container spacing={3}>
                        <Grid item xs={7} md={5} lg={3}>
                            <FormControl style={{ marginTop: -5 }} fullWidth>
                                <FormHelperText>{I18n.t('oscillator')}</FormHelperText>
                                <ToggleSwitch
                                    attr="oscExternal"
                                    offLabel="Internal"
                                    onLabel="External"
                                    value={config.oscExternal}
                                    onChange={(value) => this.doHandleChange('oscExternal', value)}
                                    style={{ marginTop: -4 }}
                                />
                            </FormControl>
                        </Grid>
                        {!config.oscExternal && (
                            <Grid item xs={5} md={4} lg={3}>
                                <Dropdown
                                    attr="oscFrequency"
                                    title="oscFrequency"
                                    options={this.oscFrequencyOptions}
                                    value={config.oscFrequency.toString()}
                                    onChange={(value) => this.doHandleChange('oscFrequency', parseInt(value))}
                                />
                            </Grid>
                        )}
                    </Grid>
                )}
                {extra.showLed && (
                    <Grid container spacing={3}>
                        <Grid item xs={6} md={3}>
                            <Dropdown
                                attr="ledFrequency"
                                title="ledFrequency"
                                options={this.ledFrequencyOptions}
                                value={config.ledFrequency.toString()}
                                onChange={(value) => this.doHandleChange('ledFrequency', parseInt(value))}
                            />
                        </Grid>
                        <Grid item xs={6} md={4}>
                            <FormControl style={{ marginTop: -5 }} fullWidth>
                                <FormHelperText>
                                    {config.ledLog.length === 1 ? I18n.t('ledLog') : I18n.t('ledLog0')}
                                </FormHelperText>
                                <ToggleSwitch
                                    attr="ledLog0"
                                    offLabel="Linear"
                                    onLabel="Logarithmic"
                                    value={config.ledLog[0]}
                                    onChange={(value) => this.onLedLogChange(0, value)}
                                    style={{ marginTop: -4 }}
                                />
                            </FormControl>
                        </Grid>
                        {config.ledLog.length === 2 && (
                            <Grid item xs={6} md={4}>
                                <FormControl style={{ marginTop: -5 }} fullWidth>
                                    <FormHelperText>{I18n.t('ledLog1')}</FormHelperText>
                                    <ToggleSwitch
                                        attr="ledLog1"
                                        offLabel="Linear"
                                        onLabel="Logarithmic"
                                        value={config.ledLog[1]}
                                        onChange={(value) => this.onLedLogChange(1, value)}
                                        style={{ marginTop: -4 }}
                                    />
                                </FormControl>
                            </Grid>
                        )}
                    </Grid>
                )}
                {(extra.showDebounce || extra.showKeypad) && (
                    <Grid container spacing={3}>
                        <Grid item xs={6} md={4} lg={3}>
                            <Dropdown
                                attr="debounceTime"
                                title="debounceTime"
                                options={this.debounceTimeOptions}
                                value={config.debounceTime.toString()}
                                onChange={this.onDebounceTimeChange}
                            />
                        </Grid>
                    </Grid>
                )}
                {extra.showKeypad && (
                    <>
                        <Grid container spacing={3}>
                            <Grid item xs={6} md={3}>
                                <Dropdown
                                    attr="keyRowCount"
                                    title="keyRowCount"
                                    options={this.keyRowsOptions}
                                    value={config.keypad.rowCount.toString()}
                                    onChange={(value) => this.onKeypadChange('rowCount', parseInt(value))}
                                />
                            </Grid>
                            {config.keypad.rowCount > 0 && (
                                <>
                                    <Grid item xs={6} md={3}>
                                        <Dropdown
                                            attr="keyColumnCount"
                                            title="keyColumnCount"
                                            options={this.keyColsOptions}
                                            value={config.keypad.columnCount.toString()}
                                            onChange={(value) => this.onKeypadChange('columnCount', parseInt(value))}
                                        />
                                    </Grid>
                                    {extra.hasAutoSleep && (
                                        <Grid item xs={6} md={3}>
                                            <Dropdown
                                                attr="keyAutoSleep"
                                                title="keyAutoSleep"
                                                options={this.keyAutoSleepOptions}
                                                value={config.keypad.autoSleep.toString()}
                                                onChange={(value) => this.onKeypadChange('autoSleep', parseInt(value))}
                                            />
                                        </Grid>
                                    )}
                                    <Grid item xs={6} md={3}>
                                        <Dropdown
                                            attr="keyScanTime"
                                            title="keyScanTime"
                                            options={this.getKeyScanTimeOptions()}
                                            value={config.keypad.scanTime.toString()}
                                            onChange={(value) => this.onKeypadChange('scanTime', parseInt(value))}
                                        />
                                    </Grid>
                                </>
                            )}
                        </Grid>

                        {config.keypad.rowCount > 0 && (
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <FormControl fullWidth>
                                        <FormHelperText>{I18n.t('keypadValues')}</FormHelperText>
                                        {this.renderKeypadGrid()}
                                    </FormControl>
                                </Grid>
                            </Grid>
                        )}
                    </>
                )}
                {this.state.config.pins.map(this.renderPin)}
            </>
        );
    }

    private renderKeypadGrid(): React.ReactNode {
        const keypad = this.state.config.keypad;
        return (
            <>
                <Grid container spacing={1}>
                    <Grid item xs={2} md={1}></Grid>
                    {keypad.keyValues[0]
                        .filter((_, index) => index <= keypad.columnCount)
                        .map((_, column) => (
                            <Grid key={`keypad-col-${column}`} item xs={1}>
                                <strong>
                                    {I18n.t('Column')} {column}
                                </strong>
                            </Grid>
                        ))}
                </Grid>
                {keypad.keyValues
                    .filter((_, index) => index <= keypad.rowCount)
                    .map((row, rowIndex) => (
                        <Grid key={`keypad-${rowIndex}`} container spacing={1}>
                            <Grid item xs={2} md={1}>
                                <strong>
                                    {I18n.t('Row')} {rowIndex}
                                </strong>
                            </Grid>
                            {row
                                .filter((_, index) => index <= keypad.columnCount)
                                .map((cell, colIndex) => (
                                    <Grid key={`keypad-${rowIndex}-${colIndex}`} item xs={1}>
                                        <TextField
                                            name={`keyValue-${rowIndex}-${colIndex}`}
                                            value={cell}
                                            type="text"
                                            fullWidth
                                            onChange={this.handleKeyValueChange}
                                        />
                                    </Grid>
                                ))}
                        </Grid>
                    ))}
            </>
        );
    }

    private getModeOptions(index: number): DropdownOption[] {
        const mode = this.state.config.pins[index].mode;
        const caps = this.state.extra?.caps[index] as PinCapabilities;
        const options: DropdownOption[] = [];
        if (mode === 'keypad') {
            // keypad is chosen from the outside (by choosing a number of rows for the keypad)
            options.push({ value: 'keypad', title: I18n.t('Keypad') });
        } else if (mode === 'level-shifter' && !caps.levelShift) {
            // level shifter is automatically enabled when the corresponding bank A pin is set to level shifter
            options.push({ value: 'level-shifter', title: I18n.t('Level Shifter') });
        } else {
            options.push({ value: 'none', title: I18n.t('None') });
            options.push({ value: 'input', title: I18n.t('Input') });
            options.push({ value: 'output', title: I18n.t('Output') });
            if (caps.levelShift) {
                const pins = this.state.config.pins;
                const bankBMode = pins[index + pins.length / 2].mode;
                options.push({
                    value: 'level-shifter',
                    title: I18n.t('Level Shifter'),
                    disabled: bankBMode != 'none' && bankBMode != 'level-shifter',
                });
            }
            if (this.state.extra?.showLed) {
                options.push({ value: 'led-channel', title: I18n.t('led-channel') });
                options.push({ value: 'led-static', title: I18n.t('led-static') });
                if (caps.blink) {
                    options.push({ value: 'led-single', title: I18n.t('led-single') });
                    options.push({ value: 'led-blink', title: I18n.t('led-blink') });
                }
            }
        }

        return options;
    }

    private getLevelShifterModeOptions(index: number): DropdownOption[] {
        const pin = I18n.t('Pin');
        const bankSize = this.pinCount / 2;
        const firstPin = index % bankSize;
        const secondPin = firstPin + bankSize;
        return [
            { value: 'AtoB', title: `${pin} ${firstPin} → ${pin} ${secondPin}` },
            { value: 'BtoA', title: `${pin} ${secondPin} → ${pin} ${firstPin}` },
        ];
    }

    private getLedTimeOptions(): DropdownOption[] {
        const clockFrequency = 2000000 / (1 << (this.state.config.ledFrequency - 1));
        const options: DropdownOption[] = [];
        for (let i = 1; i < 32; i++) {
            const factor = i < 16 ? 64 : 512;
            let value = (factor * i * 255) / clockFrequency;
            let unit = 'sec';
            if (value < 1) {
                value *= 1000;
                unit = 'ms';
            }
            options.push({ value: i.toString(), title: `${value.toFixed(2)} ${unit}` });
        }
        return options;
    }

    private getLedFadeOptions(index: number): DropdownOption[] {
        const config = this.state.config.pins[index].led;
        const clockFrequency = 2000000 / (1 << (this.state.config.ledFrequency - 1));
        const options: DropdownOption[] = [{ value: '0', title: I18n.t('Off') }];
        for (let i = 1; i < 32; i++) {
            const factor = i < 16 ? 1 : 16;
            const diff = config.intensityOn - factor * config.intensityOff;
            let value = (diff * i * 255) / clockFrequency;
            let unit = 'sec';
            if (value < 1) {
                value *= 1000;
                unit = 'ms';
            }
            options.push({ value: i.toString(), title: `${value.toFixed(2)} ${unit}` });
        }
        return options;
    }

    @boundMethod
    private renderPin(pin: PinConfig, index: number): React.ReactNode {
        const modeOptions = this.getModeOptions(index);
        const extra = this.state.extra as SX150xExtra;
        const caps = extra.caps[index];
        return (
            <div key={`pin-c-${index}`}>
                <hr />
                <Grid container spacing={3}>
                    <Grid item xs={2} md={1} style={{ paddingTop: '23px' }}>
                        <strong>{`${I18n.t('Pin')} ${index}`}</strong>
                    </Grid>
                    <Grid item xs={3} md={2} xl={1}>
                        <Dropdown
                            attr={`${index}-mode`}
                            title="Mode"
                            disabled={modeOptions.length === 1}
                            options={modeOptions}
                            value={pin.mode}
                            onChange={(value) => this.onPinChange(index, 'mode', value as PinMode)}
                        />
                    </Grid>
                    {(pin.mode === 'input' ||
                        pin.mode === 'output' ||
                        pin.mode.startsWith('led-') ||
                        pin.mode === 'level-shifter') && (
                        <Grid item xs={2}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={pin.invert}
                                        onChange={(_, checked) => this.onPinChange(index, 'invert', checked)}
                                        name={`${index}-invert`}
                                    />
                                }
                                label={I18n.t('inverted')}
                                style={{ marginTop: '12px' }}
                            />
                        </Grid>
                    )}
                    {(pin.mode === 'input' || pin.mode === 'output') && (
                        <Grid item xs={3} md={2} xl={1}>
                            <Dropdown
                                attr={`${index}-resistor`}
                                title="Resistor"
                                options={this.resistorOptions}
                                value={pin.resistor}
                                onChange={(value) => this.onPinChange(index, 'resistor', value as any)}
                            />
                        </Grid>
                    )}
                    {pin.mode === 'output' && (
                        <Grid item xs={3} md={2} xl={1}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={pin.openDrain}
                                        onChange={(_, checked) => this.onPinChange(index, 'openDrain', checked)}
                                        name={`${index}-openDrain`}
                                    />
                                }
                                label={I18n.t('openDrain')}
                                style={{ marginTop: '12px' }}
                            />
                        </Grid>
                    )}
                    {pin.mode === 'input' && extra.showDebounce && (
                        <Grid item xs={2}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={pin.debounce}
                                        onChange={(_, checked) => this.onPinChange(index, 'debounce', checked)}
                                        name={`${index}-debounce`}
                                    />
                                }
                                label={I18n.t('debounce')}
                                style={{ marginTop: '12px' }}
                            />
                        </Grid>
                    )}
                    {pin.mode === 'input' && (
                        <Grid item xs={3} md={2} xl={1}>
                            <Dropdown
                                attr={`${index}-interrupt`}
                                title="interruptTrigger"
                                options={this.interruptOptions}
                                value={pin.interrupt}
                                onChange={(value) => this.onPinChange(index, 'interrupt', value as any)}
                            />
                        </Grid>
                    )}
                    {pin.mode === 'input' && extra.hasHighInput && (
                        <Grid item xs={2}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={pin.highInput}
                                        onChange={(_, checked) => this.onPinChange(index, 'highInput', checked)}
                                        name={`${index}-highInput`}
                                    />
                                }
                                label={I18n.t('highInput')}
                                style={{ marginTop: '12px' }}
                            />
                        </Grid>
                    )}
                    {pin.mode === 'level-shifter' && (
                        <Grid item xs={3} md={2} xl={1}>
                            <Dropdown
                                attr={`${index}-levelShifterMode`}
                                title="levelShifterMode"
                                options={this.getLevelShifterModeOptions(index)}
                                value={pin.levelShifterMode}
                                onChange={(value) => this.onPinChange(index, 'levelShifterMode', value as any)}
                                disabled={index >= this.pinCount / 2}
                            />
                        </Grid>
                    )}
                    {pin.mode.startsWith('led-') && pin.mode !== 'led-channel' && (
                        <Grid item xs={3} md={2} xl={1}>
                            <TextField
                                name={`${index}-intensityOn`}
                                label={I18n.t('ledIntensityOn')}
                                value={pin.led.intensityOn}
                                type="number"
                                inputProps={{ min: '0', max: '255', step: '1' }}
                                fullWidth
                                onChange={(event) =>
                                    this.onPinLedChange(index, 'intensityOn', parseInt(event.target.value))
                                }
                            />
                        </Grid>
                    )}
                    {(pin.mode === 'led-single' || pin.mode === 'led-blink') && (
                        <Grid item xs={3} md={2} xl={1}>
                            <Dropdown
                                attr={`${index}-timeOn`}
                                title="ledTimeOn"
                                options={this.getLedTimeOptions()}
                                value={pin.led.timeOn.toString()}
                                onChange={(value) => this.onPinLedChange(index, 'timeOn', parseInt(value))}
                            />
                        </Grid>
                    )}
                    {pin.mode === 'led-blink' && (
                        <>
                            <Grid item xs={3} md={2} xl={1}>
                                <Dropdown
                                    attr={`${index}-intensityOff`}
                                    title="ledIntensityOff"
                                    options={this.ledIntensityOffOptions}
                                    value={pin.led.intensityOff.toString()}
                                    onChange={(value) => this.onPinLedChange(index, 'intensityOff', parseInt(value))}
                                />
                            </Grid>
                            <Grid item xs={3} md={2} xl={1}>
                                <Dropdown
                                    attr={`${index}-timeOff`}
                                    title="ledTimeOff"
                                    options={this.getLedTimeOptions()}
                                    value={pin.led.timeOff.toString()}
                                    onChange={(value) => this.onPinLedChange(index, 'timeOff', parseInt(value))}
                                />
                            </Grid>
                        </>
                    )}
                    {pin.mode.startsWith('led-') && pin.mode !== 'led-channel' && caps.breath && (
                        <>
                            <Grid item xs={3} md={2} xl={1}>
                                <Dropdown
                                    attr={`${index}-timeRaise`}
                                    title="ledTimeRaise"
                                    options={this.getLedFadeOptions(index)}
                                    value={pin.led.timeRaise.toString()}
                                    onChange={(value) => this.onPinLedChange(index, 'timeRaise', parseInt(value))}
                                />
                            </Grid>
                            <Grid item xs={3} md={2} xl={1}>
                                <Dropdown
                                    attr={`${index}-timeFall`}
                                    title="ledTimeFall"
                                    options={this.getLedFadeOptions(index)}
                                    value={pin.led.timeFall.toString()}
                                    onChange={(value) => this.onPinLedChange(index, 'timeFall', parseInt(value))}
                                />
                            </Grid>
                        </>
                    )}
                </Grid>
            </div>
        );
    }
}

export const Infos: DeviceInfo[] = [
    { name: 'SX1507', addresses: [0x3e, 0x3f, 0x70, 0x71], type: 'SX150x', react: SX150x },
    { name: 'SX1508', addresses: [0x20, 0x21, 0x22, 0x23], type: 'SX150x', react: SX150x },
    { name: 'SX1509', addresses: [0x3e, 0x3f, 0x70, 0x71], type: 'SX150x', react: SX150x },
];
