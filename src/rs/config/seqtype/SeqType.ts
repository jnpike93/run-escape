import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { SeqFrameLoader } from "../../model/seq/SeqFrameLoader";
import { Type } from "../Type";

export class SeqSoundEffect {
    constructor(
        readonly id: number,
        readonly loops: number,
        readonly location: number,
        readonly retain: number,
    ) {}
}

function decodeSoundEffect(
    buffer: ByteBuffer,
    isNewSoundEffects: boolean,
    hasUnknown: boolean,
): SeqSoundEffect {
    let id: number;
    let loops: number;
    let location: number;
    let retain: number = 0;
    if (isNewSoundEffects) {
        id = buffer.readUnsignedShort();
        if (hasUnknown) {
            buffer.readUnsignedByte();
        }
        loops = buffer.readUnsignedByte();
        location = buffer.readUnsignedByte();
        retain = buffer.readUnsignedByte();
    } else {
        const sound = buffer.readUnsignedMedium();
        id = sound >> 8;
        loops = (sound >> 4) & 0x7;
        location = sound & 0xf;
    }
    return new SeqSoundEffect(id, loops, location, retain);
}

export class SeqType extends Type {
    frameIds!: number[];
    chatFrameIds?: number[];
    frameLengths!: number[];
    frameSounds?: Map<number, SeqSoundEffect[]>;

    frameStep: number;

    masks?: number[];

    stretches: boolean;

    forcedPriority: number;

    leftHandItem: number;
    rightHandItem: number;

    maxLoops: number;

    looping: boolean;

    precedenceAnimating: number;

    priority: number;

    replyMode: number;

    skeletalId: number;
    skeletalStart: number;
    skeletalEnd: number;
    skeletalMasks?: boolean[];

    op14: boolean;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.frameStep = -1;
        this.stretches = false;
        this.forcedPriority = 5;
        this.leftHandItem = -1;
        this.rightHandItem = -1;
        this.maxLoops = 99;
        this.looping = false;
        this.precedenceAnimating = -1;
        this.priority = -1;
        this.replyMode = 2;
        this.skeletalId = -1;
        this.skeletalStart = 0;
        this.skeletalEnd = 0;
        this.op14 = false;
    }

    getFrameLength(seqFrameLoader: SeqFrameLoader, frame: number): number {
        let frameLength = this.frameLengths[frame];

        if (this.cacheType === "legacy" || this.cacheType === "dat") {
            if (frameLength === 0) {
                const animFrame = seqFrameLoader.load(this.frameIds[frame]);
                if (animFrame) {
                    frameLength = this.frameLengths[frame] = animFrame.frameLength;
                }
            }

            if (frameLength === 0) {
                frameLength = 1;
            }
        }

        return frameLength;
    }

    isNewSoundEffects(): boolean {
        return this.cacheInfo.game === "oldschool" && this.cacheInfo.revision >= 220;
    }

    decodeFrameSounds(buffer: ByteBuffer): void {
        const count = buffer.readUnsignedByte();
        if (!this.frameSounds) {
            this.frameSounds = new Map();
        }

        const isNewSoundEffects = this.isNewSoundEffects();

        for (let i = 0; i < count; i++) {
            const soundEffect = decodeSoundEffect(buffer, isNewSoundEffects, false);
            const effects = this.frameSounds.get(i);
            if (effects) {
                effects.push(soundEffect);
            } else {
                this.frameSounds.set(i, [soundEffect]);
            }
        }
    }

    decodeSparseFrameSounds(buffer: ByteBuffer, hasUnknown: boolean): void {
        const count = buffer.readUnsignedShort();
        if (!this.frameSounds) {
            this.frameSounds = new Map();
        }

        const isNewSoundEffects = this.isNewSoundEffects();

        for (let i = 0; i < count; i++) {
            const frame = buffer.readUnsignedShort();
            const soundEffect = decodeSoundEffect(buffer, isNewSoundEffects, hasUnknown);
            const effects = this.frameSounds.get(frame);
            if (effects) {
                effects.push(soundEffect);
            } else {
                this.frameSounds.set(frame, [soundEffect]);
            }
        }
    }

    decodeSkeletalId(buffer: ByteBuffer): void {
        this.skeletalId = buffer.readInt();
    }

    decodeSkeletalDuration(buffer: ByteBuffer): void {
        this.skeletalStart = buffer.readUnsignedShort();
        this.skeletalEnd = buffer.readUnsignedShort();
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            let count = 0;
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision < 456) {
                count = buffer.readUnsignedByte();
            } else {
                count = buffer.readUnsignedShort();
            }
            this.frameIds = new Array(count);
            this.frameLengths = new Array(count);

            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision <= 377) {
                for (let i = 0; i < count; i++) {
                    this.frameIds[i] = buffer.readUnsignedShort();
                    // used by widgets
                    buffer.readUnsignedShort();
                    this.frameLengths[i] = buffer.readUnsignedShort();
                }
            } else {
                for (let i = 0; i < count; i++) {
                    this.frameLengths[i] = buffer.readUnsignedShort();
                }
                for (let i = 0; i < count; i++) {
                    this.frameIds[i] = buffer.readUnsignedShort();
                }
                for (let i = 0; i < count; i++) {
                    this.frameIds[i] += buffer.readUnsignedShort() << 16;
                }
            }
        } else if (opcode === 2) {
            this.frameStep = buffer.readUnsignedShort();
        } else if (opcode === 3) {
            const count = buffer.readUnsignedByte();
            this.masks = new Array(count + 1);
            for (let i = 0; i < count; i++) {
                this.masks[i] = buffer.readUnsignedByte();
            }
            this.masks[count] = 9999999;
        } else if (opcode === 4) {
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision <= 194) {
                this.stretches = buffer.readUnsignedShort() === 1;
            } else {
                this.stretches = true;
            }
        } else if (opcode === 5) {
            this.forcedPriority = buffer.readUnsignedByte();
        } else if (opcode === 6) {
            this.leftHandItem = buffer.readUnsignedShort();
        } else if (opcode === 7) {
            this.rightHandItem = buffer.readUnsignedShort();
        } else if (opcode === 8) {
            this.maxLoops = buffer.readUnsignedByte();
            this.looping = true;
        } else if (opcode === 9) {
            this.precedenceAnimating = buffer.readUnsignedByte();
        } else if (opcode === 10) {
            this.priority = buffer.readUnsignedByte();
        } else if (opcode === 11) {
            this.replyMode = buffer.readUnsignedByte();
        } else if (opcode === 12) {
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision <= 377) {
                buffer.readInt();
            } else {
                const count = buffer.readUnsignedByte();
                this.chatFrameIds = new Array(count);

                for (let i = 0; i < count; i++) {
                    this.chatFrameIds[i] = buffer.readUnsignedShort();
                }
                for (let i = 0; i < count; i++) {
                    this.chatFrameIds[i] += buffer.readUnsignedShort() << 16;
                }
            }
        } else if (opcode === 13) {
            // might be wrong start revision
            if (this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 508) {
                const count = buffer.readUnsignedShort();
                for (let i = 0; i < count; i++) {
                    const effectCount = buffer.readUnsignedByte();
                    if (effectCount > 0) {
                        buffer.readMedium();
                        for (let e = 1; e < effectCount; e++) {
                            buffer.readUnsignedShort();
                        }
                    }
                }
            } else if (this.cacheInfo.game === "oldschool" && this.cacheInfo.revision >= 226) {
                this.decodeSkeletalId(buffer);
            } else {
                this.decodeFrameSounds(buffer);
            }
        } else if (opcode === 14) {
            if (this.cacheInfo.game === "oldschool") {
                if (this.cacheInfo.revision >= 226) {
                    this.decodeSparseFrameSounds(buffer, true);
                } else {
                    this.decodeSkeletalId(buffer);
                }
            } else {
                this.op14 = true;
            }
        } else if (opcode === 15) {
            if (this.cacheInfo.game === "oldschool") {
                if (this.cacheInfo.revision >= 226) {
                    this.decodeSkeletalDuration(buffer);
                } else {
                    this.decodeSparseFrameSounds(buffer, false);
                }
            } else {
                // interpolate = true;
            }
        } else if (opcode === 16) {
            if (this.cacheInfo.game === "oldschool") {
                if (this.cacheInfo.revision < 226) {
                    this.decodeSkeletalDuration(buffer);
                } else if (this.cacheInfo.revision >= 233) {
                    const heightOffset = buffer.readUnsignedByte();
                }
            } else {
                // bool = true;
            }
        } else if (opcode === 17) {
            if (this.cacheInfo.game === "oldschool") {
                const count = buffer.readUnsignedByte();

                this.skeletalMasks = new Array(256).fill(false);

                for (let i = 0; i < count; i++) {
                    this.skeletalMasks[buffer.readUnsignedByte()] = true;
                }
            } else {
                const v = buffer.readUnsignedByte();
            }
        } else if (opcode === 18) {
            if (this.cacheInfo.game === "oldschool" && this.cacheInfo.revision >= 230) {
                const name = buffer.readString();
            } else {
                const b = true;
            }
        } else if (opcode === 19) {
            if (this.cacheInfo.game === "oldschool") {
                // crossworldsound = true;
            } else {
                const index = buffer.readUnsignedByte();
                const value = buffer.readUnsignedByte();
            }
        } else if (opcode === 20) {
            const index = buffer.readUnsignedByte();
            const max = buffer.readUnsignedShort();
            const min = buffer.readUnsignedShort();
        } else {
            throw new Error("SeqType: Opcode " + opcode + " not implemented.");
        }
    }

    override post(): void {
        if (this.id === 9171) {
            // Ancient godsword Blood Sacrifice special (slim-cache fallback to ZGS 7638 frames)
            this.skeletalId = -1;
            this.frameIds = [
                796000257, 796000261, 796000260, 796000262, 796000266, 796000263, 796000264,
                796000265, 796000258, 796000280, 796000268, 796000269, 796000270, 796000271,
                796000259, 796000272, 796000273, 796000274, 796000275, 796000276, 796000267,
                796000277, 796000278, 796000279, 796000257,
            ];
            this.frameLengths = [
                2, 2, 2, 2, 2, 2, 3, 3, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
            ];
        } else if (this.id === 7514 || this.id === 7511) {
            // Burning claws special (7514) & Dinh's bulwark bash (7511) (slim-cache fallback to 393/401 frames)
            this.skeletalId = -1;
            this.frameIds = [
                696778753, 696778754, 696778755, 696778756, 696778757, 696778758, 696778759,
                696778760,
            ];
            this.frameLengths = [4, 4, 4, 4, 8, 2, 8, 4];
        } else if (this.id === 7516) {
            // Elder maul swing & Pulverise special (slim-cache fallback to Tzhaar-ket-om 2661 frames)
            this.skeletalId = -1;
            this.frameIds = [
                770703361, 770703362, 770703363, 770703364, 770703365, 770703366, 770703367,
                770703368, 770703369, 770703370, 770703371, 770703372, 770703373, 770703374,
                770703375, 770703376, 770703377, 770703378, 770703379, 770703380, 770703381,
            ];
            this.frameLengths = [
                5, 5, 4, 4, 5, 5, 6, 7, 10, 2, 1, 1, 2, 2, 2, 2, 11, 4, 4, 5, 6,
            ];
        } else if (this.id === 3157) {
            // Thunder khopesh Thunderclap special (slim-cache fallback to 7045 slash frames)
            this.skeletalId = -1;
            this.frameIds = [
                795344897, 795344909, 795344903, 795344904, 795344910, 795344911, 795344905,
                795344898, 795344912, 795344906, 795344901, 795344914, 795344899, 795344907,
                795344900, 795344902, 795344908, 795344913, 795344897,
            ];
            this.frameLengths = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2];
        }
    }

    isSkeletalSeq(): boolean {
        return this.skeletalId >= 0;
    }

    getSkeletalDuration(): number {
        return this.skeletalEnd - this.skeletalStart;
    }
}
