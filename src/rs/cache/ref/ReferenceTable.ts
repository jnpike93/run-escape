import { ByteBuffer } from "../../io/ByteBuffer";
import { StringUtil } from "../../util/StringUtil";
import { ArchiveReference } from "./ArchiveReference";

const SINGLE_ZERO_FILE_IDS = new Int32Array([0]);

export class ReferenceTable {
    static INVALID_TABLE = new ReferenceTable(
        -1,
        -1,
        false,
        false,
        0,
        -1,
        new Map(),
        new Int32Array(),
        new Int32Array(),
        [],
        new DataView(new ArrayBuffer(0)),
        new DataView(new ArrayBuffer(0)),
        new Int32Array(),
        new Int32Array(),
        [],
        [],
    );

    static fromArchiveCount(archiveCount: number): ReferenceTable {
        const archiveIds = new Int32Array(archiveCount);
        const archiveIdIndexMap: Map<number, number> = new Map();
        for (let i = 0; i < archiveCount; i++) {
            archiveIds[i] = i;
            archiveIdIndexMap.set(i, i);
        }
        const lastArchiveId = archiveCount - 1;

        const archiveNameHashes = new Int32Array(archiveCount);
        const archiveWhirlpools = new Array<Int8Array>(archiveCount);

        const archiveFileCounts = new Int32Array(archiveCount).fill(-1);

        const archiveFileIds = new Array<Int32Array>(archiveCount);
        const archiveLastFileIds = new Int32Array(archiveCount);

        const archiveFileNameHashes = new Array<Int32Array>(archiveCount);

        return new ReferenceTable(
            -1,
            -1,
            false,
            false,
            archiveCount,
            lastArchiveId,
            archiveIdIndexMap,
            archiveIds,
            archiveNameHashes,
            archiveWhirlpools,
            new DataView(new ArrayBuffer(archiveCount * 4)),
            new DataView(new ArrayBuffer(archiveCount * 4)),
            archiveFileCounts,
            archiveLastFileIds,
            archiveFileIds,
            archiveFileNameHashes,
        );
    }

    static decode(buffer: ByteBuffer): ReferenceTable {
        const protocol = buffer.readUnsignedByte();
        if (protocol < 5 || protocol > 7) {
            throw new Error("Invalid protocol: " + protocol);
        }
        const revision = protocol > 5 ? buffer.readInt() : 0;
        const flag = buffer.readUnsignedByte();
        const hasNames = (flag & 0x1) !== 0;
        const hasWhirlpool = (flag & 0x2) !== 0;
        const hasSizes = (flag & 0x4) !== 0;
        const hasUncompressedCrcs = (flag & 0x8) !== 0;
        const archiveCount = protocol === 7 ? buffer.readBigSmart() : buffer.readUnsignedShort();

        let lastArchiveId = 0;
        const archiveIds = new Int32Array(archiveCount);
        const archiveIdIndexMap: Map<number, number> = new Map();
        if (protocol === 7) {
            for (let i = 0; i < archiveCount; i++) {
                lastArchiveId += buffer.readBigSmart();
                archiveIds[i] = lastArchiveId;
                archiveIdIndexMap.set(lastArchiveId, i);
            }
        } else {
            for (let i = 0; i < archiveCount; i++) {
                lastArchiveId += buffer.readUnsignedShort();
                archiveIds[i] = lastArchiveId;
                archiveIdIndexMap.set(lastArchiveId, i);
            }
        }

        const archiveNameHashes = hasNames ? new Int32Array(archiveCount) : new Int32Array(0);
        if (hasNames) {
            for (let i = 0; i < archiveCount; i++) {
                archiveNameHashes[i] = buffer.readInt();
            }
        }

        const archiveWhirlpools = hasWhirlpool ? new Array<Int8Array>(archiveCount) : [];
        if (hasWhirlpool) {
            for (let i = 0; i < archiveCount; i++) {
                archiveWhirlpools[i] = buffer.readBytes(64);
            }
        }

        const archiveCrcs = new DataView(
            buffer.data.buffer,
            buffer.data.byteOffset + buffer.offset,
            archiveCount * 4,
        );
        buffer.offset += archiveCrcs.byteLength;

        if (hasSizes) {
            buffer.offset += archiveCount * 8;
        }

        const archiveRevisions = new DataView(
            buffer.data.buffer,
            buffer.data.byteOffset + buffer.offset,
            archiveCount * 4,
        );
        buffer.offset += archiveRevisions.byteLength;

        const archiveFileCounts = new Int32Array(archiveCount);
        let totalFiles = 0;
        for (let i = 0; i < archiveCount; i++) {
            const count = protocol === 7 ? buffer.readBigSmart() : buffer.readUnsignedShort();
            archiveFileCounts[i] = count;
            totalFiles += count;
        }

        const archiveFileIds = new Array<Int32Array>(archiveCount);
        const archiveLastFileIds = new Int32Array(archiveCount);
        const flatFileIds = new Int32Array(totalFiles);
        let fileOffset = 0;
        for (let archiveIdx = 0; archiveIdx < archiveCount; archiveIdx++) {
            const count = archiveFileCounts[archiveIdx];
            let lastFileId = 0;
            for (let fileIdx = 0; fileIdx < count; fileIdx++) {
                lastFileId += protocol === 7 ? buffer.readBigSmart() : buffer.readUnsignedShort();
                flatFileIds[fileOffset + fileIdx] = lastFileId;
            }
            archiveFileIds[archiveIdx] =
                count === 1 && lastFileId === 0
                    ? SINGLE_ZERO_FILE_IDS
                    : flatFileIds.subarray(fileOffset, fileOffset + count);
            archiveLastFileIds[archiveIdx] = lastFileId;
            fileOffset += count;
        }

        const archiveFileNameHashes = hasNames ? new Array<Int32Array>(archiveCount) : [];
        if (hasNames) {
            const flatHashes = new Int32Array(totalFiles);
            let hashOffset = 0;
            for (let archiveIdx = 0; archiveIdx < archiveCount; archiveIdx++) {
                const count = archiveFileCounts[archiveIdx];
                for (let fileIdx = 0; fileIdx < count; fileIdx++) {
                    flatHashes[hashOffset + fileIdx] = buffer.readInt();
                }
                archiveFileNameHashes[archiveIdx] = flatHashes.subarray(
                    hashOffset,
                    hashOffset + count,
                );
                hashOffset += count;
            }
        }

        return new ReferenceTable(
            protocol,
            revision,
            hasNames,
            hasWhirlpool,
            archiveCount,
            lastArchiveId,
            archiveIdIndexMap,
            archiveIds,
            archiveNameHashes,
            archiveWhirlpools,
            archiveCrcs,
            archiveRevisions,
            archiveFileCounts,
            archiveLastFileIds,
            archiveFileIds,
            archiveFileNameHashes,
        );
    }

    constructor(
        readonly protocol: number,
        readonly revision: number,
        readonly named: boolean,
        readonly usesWhirlpool: boolean,
        readonly archiveCount: number,
        readonly lastArchiveId: number,
        private readonly _archiveIdIndexMap: Map<number, number>,
        readonly archiveIds: Int32Array,
        private readonly _archiveNameHashes: Int32Array,
        private readonly _archiveWhirlpools: Int8Array[],
        private readonly _archiveCrcs: DataView,
        private readonly _archiveRevisions: DataView,
        private readonly _archiveFileCounts: Int32Array,
        private readonly _archiveLastFileIds: Int32Array,
        private readonly _archiveFileIds: Int32Array[],
        private readonly _archiveFileNameHashes: Int32Array[],
        private readonly _archiveNameHashIdMap: Map<number, number> = new Map(),
    ) {
        if (named) {
            for (let i = 0; i < this.archiveIds.length; i++) {
                this._archiveNameHashIdMap.set(this._archiveNameHashes[i], this.archiveIds[i]);
            }
        }
    }

    getArchiveId(name: string): number | undefined {
        return this._archiveNameHashIdMap.get(StringUtil.hashDjb2(name));
    }

    archiveExists(id: number): boolean {
        return this._archiveIdIndexMap.has(id);
    }

    getArchiveReference(id: number): ArchiveReference | undefined {
        const i = this._archiveIdIndexMap.get(id);
        if (i === undefined) {
            return undefined;
        }

        const nameHash = this._archiveNameHashes[i] ?? 0;
        const whirlpool = this._archiveWhirlpools[i];
        const crc = this._archiveCrcs.getInt32(i * 4, false);
        const revision = this._archiveRevisions.getInt32(i * 4, false);
        const fileCount = this._archiveFileCounts[i];
        const lastFileId = this._archiveLastFileIds[i];
        const fileIds = this._archiveFileIds[i];
        const fileNameHashes = this._archiveFileNameHashes[i];

        return new ArchiveReference(
            id,
            nameHash,
            whirlpool,
            crc,
            revision,
            fileCount,
            lastFileId,
            undefined,
            fileIds,
            fileNameHashes,
        );
    }

    get archiveReferences(): ArchiveReference[] {
        const refs = new Array<ArchiveReference>(this.archiveIds.length);
        for (let i = 0; i < this.archiveIds.length; i++) {
            const ref = this.getArchiveReference(this.archiveIds[i]);
            if (ref) {
                refs[i] = ref;
            }
        }
        return refs;
    }
}
