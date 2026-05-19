import React from 'react';

interface RobuxIconProps {
  className?: string;
  size?: number | string;
}

export default function RobuxIcon({ className = "w-4 h-4", size }: RobuxIconProps) {
  const style = size ? { width: size, height: size } : {};
  return (
    <img 
      src="https://devforum-uploads.s3.dualstack.us-east-2.amazonaws.com/uploads/original/4X/c/2/f/c2fc0404eeb8d393407bdaebe2cc9994a8953550.png" 
      alt="Robux"
      className={`${className} object-contain`}
      style={style}
    />
  );
}
