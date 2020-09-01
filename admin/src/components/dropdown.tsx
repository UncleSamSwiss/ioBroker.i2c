import * as React from 'react';
import { isObject, isArray } from 'alcalzone-shared/typeguards';
import { composeObject } from 'alcalzone-shared/objects';
import { boundMethod } from 'autobind-decorator';
import { ReactNode } from 'react';

const M_Select = M.FormSelect || ((M as any).Select as typeof M.FormSelect);

export interface DropdownProps {
    id?: string;
    options: { [key: string]: string } | string[];
    selectedOption?: string;
    selectedChanged: (selected: string) => void;
}

interface DropdownState {
    selectedOption?: string;
}

export class Dropdown extends React.Component<DropdownProps, DropdownState> {
    private static defaultProps = {
        selectedOption: undefined,
    };

    constructor(props: DropdownProps) {
        super(props);

        this.state = {
            selectedOption: props.selectedOption,
        };
    }

    private dropdown: HTMLSelectElement | null | undefined;
    private mcssSelect: M_Select | null | undefined;

    public componentDidMount(): void {
        if (this.dropdown != null) {
            //$(this.dropdown).on('change', this.readStateFromUI);

            this.mcssSelect = M_Select.getInstance(this.dropdown) || new M_Select(this.dropdown);
        }
    }

    public componentDidUpdate(prevProps: DropdownProps, _prevState: any): void {
        if (!this.dropdown) return;
        if (prevProps.options !== this.props.options) {
            this.mcssSelect = new M_Select(this.dropdown);
        }
        if (prevProps.selectedOption !== this.props.selectedOption) {
            this.setState((_, props) => ({
                selectedOption: props.selectedOption,
            }));
        }
    }

    public componentWillUnmount(): void {
        if (this.dropdown != null) {
            //$(this.dropdown).off('change', this.readStateFromUI);
        }
    }

    @boundMethod
    private readStateFromUI(event: React.FormEvent<HTMLSelectElement>): void {
        if (!this.mcssSelect) return;
        // update the adapter settings
        this.setState({
            selectedOption: (event.target as any).value,
        });
        this.props.selectedChanged((event.target as any).value);
    }

    public render(): ReactNode {
        const options = isArray(this.props.options)
            ? composeObject(this.props.options.map((o) => [o, o]))
            : isObject(this.props.options)
            ? this.props.options
            : {};
        return (
            <select
                id={this.props.id}
                ref={(me) => (this.dropdown = me)}
                value={this.state.selectedOption ?? ''}
                onChange={this.readStateFromUI}
            >
                {Object.keys(options).map((k) => (
                    <option key={k} value={k}>
                        {options[k]}
                    </option>
                ))}
            </select>
        );
    }
}
