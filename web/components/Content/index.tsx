import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';

const StyledContent = styled.div`
    display: flex;
    flex-flow: column;
    overflow-y: auto;
    flex: 1;
    height: 100%;
    padding: 0 15px;
`;

export interface IContent {
    children: ReactNode;
}

const Content: FunctionComponent<IContent> = ({ children }) => <StyledContent>{children}</StyledContent>;

export default Content;