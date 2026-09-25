import type { ImgHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export default function AppLogoIcon({
    className,
    alt = 'PANTAU',
    ...props
}: ImgHTMLAttributes<HTMLImageElement>) {
    return (
        <img
            src="/logo-pantau.png"
            alt={alt}
            className={cn('aspect-square object-contain', className)}
            {...props}
        />
    );
}
