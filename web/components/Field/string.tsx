import React, { FunctionComponent, ChangeEvent } from 'react';
import { InputGroup, ButtonGroup, Button, Classes } from '@blueprintjs/core';
import withTextContext from '../../hocomponents/withTextContext';
import { TTranslator } from '../../App';
import { IField, IFieldChange } from '../../containers/InterfaceCreator/panel';
import { camelCase, upperFirst } from 'lodash';
import compose from 'recompose/compose';
import useMount from 'react-use/lib/useMount';
import withMessageHandler, { TPostMessage, TMessageListener } from '../../hocomponents/withMessageHandler';

export interface IStringField {
    t: TTranslator;
    fill?: boolean;
    postMessage: TPostMessage;
    addMessageListener: TMessageListener;
}

const StringField: FunctionComponent<IStringField & IField & IFieldChange> = ({
    name,
    onChange,
    value,
    fill,
    style,
    postMessage,
    addMessageListener,
    get_message,
    return_message,
}) => {
    // Fetch data on mount
    useMount(() => {
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
    const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
        onChange(name, event.target.value);
    };

    // Clear the input on reset click
    const handleResetClick = (): void => {
        onChange(name, '');
    };

    const transformValueStyle: () => string = () => {
        if (style) {
            switch (style) {
                case 'PascalCase':
                    return upperFirst(camelCase(value));
                case 'camelCase':
                    return camelCase(value);
                default:
                    return value;
            }
        }

        return value;
    };

    return (
        <InputGroup
            className={fill && Classes.FILL}
            value={transformValueStyle()}
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

export default compose(
    withMessageHandler(),
    withTextContext()
)(StringField) as FunctionComponent<IStringField>;
