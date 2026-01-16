import React from 'react';

interface Props {
    message?: string;
}

const SampleTSComponent: React.FC<Props> = ({ message = "TypeScript is working!" }) => {
    return (
        <div style={{ padding: '10px', border: '1px solid #ccc', margin: '10px' }} data-testid="ts-sample">
            <h3>{message}</h3>
        </div>
    );
};

export default SampleTSComponent;
