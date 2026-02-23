import React from 'react';
import { twMerge } from 'tailwind-merge';

interface SkeletonProps {
    className?: string;
    width?: string | number;
    height?: string | number;
    circle?: boolean;
}

const Skeleton: React.FC<SkeletonProps> = ({
    className,
    width,
    height,
    circle = false
}) => {
    return (
        <div
            className={twMerge(
                "animate-pulse bg-slate-200 dark:bg-slate-700",
                circle ? "rounded-full" : "rounded-md",
                className
            )}
            style={{
                width: width,
                height: height
            }}
        />
    );
};

export default Skeleton;
