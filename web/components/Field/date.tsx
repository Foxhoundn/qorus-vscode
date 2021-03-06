import React, { FunctionComponent, ChangeEvent } from 'react';
import { InputGroup, ButtonGroup, Button, Classes, ControlGroup } from '@blueprintjs/core';
import { DateInput } from '@blueprintjs/datetime';
import withTextContext from '../../hocomponents/withTextContext';
import { TTranslator } from '../../App';
import { IField, IFieldChange } from '../../containers/InterfaceCreator/panel';
import compose from 'recompose/compose';
import useMount from 'react-use/lib/useMount';
import withMessageHandler, { TPostMessage, TMessageListener } from '../../hocomponents/withMessageHandler';
import { getValueOrDefaultValue } from '../../helpers/validations';

export interface IDateField {
    t?: TTranslator;
    fill?: boolean;
    postMessage?: TPostMessage;
    addMessageListener?: TMessageListener;
}

const DateField: FunctionComponent<IDateField & IField & IFieldChange> = ({
    name,
    onChange,
    value,
    default_value,
    postMessage,
    addMessageListener,
    get_message,
    return_message,
    t,
    disabled,
}) => {
    // Fetch data on mount
    useMount(() => {
        // Populate default value
        if (default_value) {
            onChange(name, getValueOrDefaultValue(value, default_value || new Date(), false));
        }
        // Get backend data
        if (get_message && return_message) {
            postMessage(get_message.action);
            addMessageListener(return_message.action, (data: any) => {
                if (data) {
                    onChange(name, data[return_message.return_value]);
                }
            });
        }
    });

    // When input value changes
    const handleInputChange = (selectedDate: Date): void => {
        onChange(name, selectedDate);
    };

    // Clear the input on reset click
    const handleResetClick = (): void => {
        onChange(name, null);
    };

    return (
        <DateInput
            timePickerProps={{}}
            closeOnSelection={false}
            disabled={disabled}
            formatDate={date => date.toLocaleString()}
            parseDate={str => new Date(str)}
            placeholder={'YYYY-MM-DDT00:00:00Z'}
            invalidDateMessage={t('InvalidDate')}
            inputProps={{ className: Classes.FILL }}
            defaultValue={new Date()}
            popoverProps={{
                targetTagName: 'div',
                wrapperTagName: 'div',
            }}
            value={!value ? new Date(default_value) : new Date(value)}
            onChange={handleInputChange}
            rightElement={
                value &&
                value !== '' && (
                    <ButtonGroup minimal>
                        <Button onClick={handleResetClick} icon={'cross'} />
                    </ButtonGroup>
                )
            }
        />
    );
};

export default compose(withMessageHandler(), withTextContext())(DateField) as FunctionComponent<
    IDateField & IField & IFieldChange
>;
