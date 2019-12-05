import React, { FC } from 'react';
import { useDrop } from 'react-dnd';
import { StyledMapperField } from '.';
import size from 'lodash/size';
import AddFieldButton from './add';
import { Button, Tooltip } from '@blueprintjs/core';
import { TTranslator } from '../../App';

export interface IMapperOutputProps {
    onDrop: (inputPath: string, outputPath: string) => any;
    id: number;
    accepts: string[];
    name: string;
    isChild: boolean;
    level: number;
    onClick: any;
    onManageClick: any;
    lastChildIndex: number;
    type: any;
    field: any;
    isCustom: boolean;
    path: string;
    hasRelation: boolean;
    t: TTranslator;
}

const MapperOutput: FC<IMapperOutputProps> = ({
    onDrop,
    id,
    accepts,
    name,
    isChild,
    level,
    onClick,
    onManageClick,
    lastChildIndex,
    type,
    field,
    isCustom,
    path,
    hasRelation,
    t,
}) => {
    const [{ canDrop, isDragging }, dropRef] = useDrop({
        accept: 'input',
        drop: item => {
            onDrop(item.id, path);
        },
        canDrop: item => {
            if (
                !hasRelation &&
                size(item.types) <= size(accepts) &&
                accepts.some((type: string) => item.types.includes(type))
            ) {
                return true;
            }
            return false;
        },
        collect: monitor => ({
            isDragging: !!monitor.getItem(),
            canDrop: monitor.canDrop(),
        }),
    });

    return (
        <StyledMapperField
            title={field.desc}
            ref={dropRef}
            style={{
                display: isDragging ? (canDrop ? 'block' : 'none') : 'block',
                //opacity: isDragging ? (canDrop ? 1 : 0.3) : 1,
                borderColor: canDrop ? '#137cbd' : '#d7d7d7',
            }}
            isChild={isChild}
            level={level}
            isDragging={isDragging && canDrop}
            childrenCount={lastChildIndex}
        >
            <h4>{name}</h4>
            <p
                className={type.types_returned
                    .join(' ')
                    .replace(/</g, '')
                    .replace(/>/g, '')}
            >
                {type.types_returned.join(',')}
            </p>
            <Tooltip content={t('ManageMapperFieldOptions')} position="right">
                <Button
                    style={{
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        left: '8px',
                        minWidth: '18px',
                        minHeight: '18px',
                    }}
                    icon="code"
                    minimal
                    small
                    intent={hasRelation ? 'success' : 'none'}
                    onClick={onManageClick}
                />
            </Tooltip>
            <AddFieldButton
                field={field}
                isCustom={isCustom}
                canManageFields={type.can_manage_fields}
                onClick={onClick}
            />
        </StyledMapperField>
    );
};

export default MapperOutput;
