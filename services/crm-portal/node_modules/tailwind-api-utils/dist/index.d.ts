import { PackageInfo, PackageResolvingOptions } from 'local-pkg';

interface DesignSystem {
    getClassOrder: (classes: string[]) => [string, bigint | null][];
    candidatesToCss: (classes: string[]) => (string | null)[];
    tailwindConfig?: {
        separator?: string;
        prefix?: string;
        content?: {
            files?: string[];
        };
    };
}

declare class TailwindUtils {
    isV4: boolean;
    packageInfo: PackageInfo;
    context: DesignSystem | null;
    private extractor;
    constructor(options?: PackageResolvingOptions);
    loadConfig(configPathOrContent: string | Record<PropertyKey, any>, options?: {
        pwd?: string;
        separator?: string;
        prefix?: string;
    }): Promise<void>;
    loadConfigV4(configPathOrContent: string | Record<PropertyKey, any>, options?: {
        pwd?: string;
        prefix?: string;
    }): Promise<void>;
    loadConfigV3(configPathOrContent: string | Record<PropertyKey, any>, options?: {
        pwd?: string;
        separator?: string;
        prefix?: string;
    }): void;
    isValidClassName(className: string): boolean;
    isValidClassName(className: string[]): boolean[];
    getSortedClassNames(className: string[]): string[];
    extract(content: string): string[];
}

export { TailwindUtils };
