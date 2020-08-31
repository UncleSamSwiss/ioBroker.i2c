import * as React from 'react';

import { Tooltip } from 'iobroker-react-components';

interface CheckboxLabelProps {
    text: string;
    class?: string[];
    tooltip?: string;
}

/** Inner label for a Materializes CSS checkbox (span, no for property) */
export function CheckboxLabel(props: CheckboxLabelProps): React.SFCElement<any> {
    const classNames: string[] = props.class || [];
    return (
        <span className={classNames.join(' ')}>
            {_(props.text)}
            {props.tooltip != null && <Tooltip text={props.tooltip} />}
        </span>
    );
}
