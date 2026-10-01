import React from 'react';
import { App, ConfigProvider, theme as antdTheme } from 'antd';
import { useAppearance } from '@/hooks/use-appearance';

export function AntdProvider({ children }: { children: React.ReactNode }) {
    const { resolvedAppearance } = useAppearance();
    const isDark = resolvedAppearance === 'dark';

    return (
        <ConfigProvider
            theme={{
                algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
                token: {
                    colorPrimary: '#dc2626', // Honda Red theme
                    borderRadius: 8,
                    fontFamily:
                        'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                },
            }}
        >
            <App>{children}</App>
        </ConfigProvider>
    );
}

export default AntdProvider;
