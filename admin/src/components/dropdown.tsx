import * as React from 'react';
import { FormControl, FormHelperText, Input, MenuItem, Select } from '@material-ui/core';
import I18n from '@iobroker/adapter-react/i18n';

export interface DropdownOption {
    value: string;
    title: string;
    disabled?: boolean;
}

interface DropdownProps {
    title?: string;
    attr: string;
    options: DropdownOption[];
    value?: string;
    disabled?: boolean;
    onChange: (value: string) => void;
    style?: any;
}

export default class Dropdown extends React.Component<DropdownProps> {
    render(): React.ReactNode {
        const { title, attr, options, value, disabled } = this.props;
        return (
            <FormControl style={{ marginTop: -5, ...this.props.style }} disabled={disabled} fullWidth>
                {title && <FormHelperText>{I18n.t(title)}</FormHelperText>}
                <Select
                    value={value || '_'}
                    onChange={(e) => this.props.onChange(e.target.value === '_' ? '' : (e.target.value as string))}
                    input={<Input name={attr} id={attr + '-helper'} />}
                    fullWidth
                    style={{ marginTop: -1 }}
                >
                    {options.map((item) => (
                        <MenuItem key={'key-' + item.value} value={item.value || '_'} disabled={item.disabled}>
                            {item.title}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        );
    }
}
