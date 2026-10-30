import { CacheInfo } from "../../cache/CacheInfo";
import { ByteBuffer } from "../../io/ByteBuffer";
import { ParamsMap, Type } from "../Type";
import { ObjStackability } from "./ObjStackability";
import { ObjTypeLoader } from "./ObjTypeLoader";

export class ObjType extends Type {
    model?: number;

    name: string;

    recolorFrom!: number[];
    recolorTo!: number[];

    retextureFrom!: number[];
    retextureTo!: number[];

    zoom2d: number;
    xan2d: number;
    yan2d: number;
    zan2d: number;

    offsetX2d: number;
    offsetY2d: number;

    op9!: string;

    stackability: ObjStackability;

    price: number;

    op13: number;

    op14: number;

    isMembers: boolean;

    groundActions: (string | null)[];
    inventoryActions: (string | null)[];
    shiftClickIndex: number;

    maleModel: number;
    maleModel1: number;
    maleOffset: number;

    femaleModel: number;
    femaleModel1: number;
    femaleOffset: number;

    maleModel2: number;
    femaleModel2: number;

    maleHeadModel: number;
    maleHeadModel2: number;

    femaleHeadModel: number;
    femaleHeadModel2: number;

    countObj!: number[];
    countCo!: number[];

    op27: number;

    note: number;
    noteTemplate: number;

    resizeX: number;
    resizeY: number;
    resizeZ: number;

    ambient: number;
    contrast: number;

    team: number;

    tradeable: boolean;
    stockmarket: boolean;

    op75: number;

    unnotedId: number;
    notedId: number;

    placeholder: number;
    placeholderTemplate: number;

    params?: ParamsMap;

    constructor(id: number, cacheInfo: CacheInfo) {
        super(id, cacheInfo);
        this.name = "null";
        this.zoom2d = 2000;
        this.xan2d = 0;
        this.yan2d = 0;
        this.zan2d = 0;
        this.offsetX2d = 0;
        this.offsetY2d = 0;
        this.stackability = ObjStackability.SOMETIMES;
        this.price = 1;
        this.op13 = -1;
        this.op14 = -1;
        this.isMembers = false;
        this.groundActions = [null, null, "Take", null, null];
        this.inventoryActions = [null, null, null, null, "Drop"];
        this.shiftClickIndex = -2;
        this.maleModel = -1;
        this.maleModel1 = -1;
        this.maleOffset = 0;
        this.femaleModel = -1;
        this.femaleModel1 = -1;
        this.femaleOffset = 0;
        this.maleModel2 = -1;
        this.femaleModel2 = -1;
        this.maleHeadModel = -1;
        this.maleHeadModel2 = -1;
        this.femaleHeadModel = -1;
        this.femaleHeadModel2 = -1;
        this.op27 = -1;
        this.note = -1;
        this.noteTemplate = -1;
        this.resizeX = 128;
        this.resizeY = 128;
        this.resizeZ = 128;
        this.ambient = 0;
        this.contrast = 0;
        this.team = 0;
        this.tradeable = true;
        this.stockmarket = false;
        this.op75 = 0;
        this.unnotedId = -1;
        this.notedId = -1;
        this.placeholder = -1;
        this.placeholderTemplate = -1;

        this.model = 0;
    }

    isLargeModelId(): boolean {
        return this.cacheInfo.game === "runescape" && this.cacheInfo.revision >= 670;
    }

    readModelId(buffer: ByteBuffer): number {
        return this.isLargeModelId() ? buffer.readBigSmart() : buffer.readUnsignedShort();
    }

    override decodeOpcode(opcode: number, buffer: ByteBuffer): void {
        if (opcode === 1) {
            this.model = this.readModelId(buffer);
        } else if (opcode === 2) {
            this.name = this.readString(buffer);
        } else if (opcode === 3) {
            // desc
            this.readString(buffer);
        } else if (opcode === 4) {
            this.zoom2d = buffer.readUnsignedShort();
        } else if (opcode === 5) {
            this.xan2d = buffer.readUnsignedShort();
        } else if (opcode === 6) {
            this.yan2d = buffer.readUnsignedShort();
        } else if (opcode === 7) {
            this.offsetX2d = buffer.readUnsignedShort();
            if (this.offsetX2d > 32767) {
                this.offsetX2d -= 65536;
            }
        } else if (opcode === 8) {
            this.offsetY2d = buffer.readUnsignedShort();
            if (this.offsetY2d > 32767) {
                this.offsetY2d -= 65536;
            }
        } else if (opcode === 9) {
            this.op9 = this.readString(buffer);
        } else if (opcode === 10) {
            buffer.readUnsignedShort();
        } else if (opcode === 11) {
            this.stackability = ObjStackability.ALWAYS;
        } else if (opcode === 12) {
            this.price = buffer.readInt();
        } else if (opcode === 13) {
            this.op13 = buffer.readUnsignedByte();
        } else if (opcode === 14) {
            this.op14 = buffer.readUnsignedByte();
        } else if (opcode === 15) {
            this.tradeable = false;
        } else if (opcode === 16) {
            this.isMembers = true;
        } else if (opcode === 23) {
            this.maleModel = this.readModelId(buffer);
            if (this.cacheInfo.revision < 503) {
                this.maleOffset = buffer.readUnsignedByte();
            }
        } else if (opcode === 24) {
            this.maleModel1 = this.readModelId(buffer);
        } else if (opcode === 25) {
            this.femaleModel = this.readModelId(buffer);
            if (this.cacheInfo.revision < 503) {
                this.femaleOffset = buffer.readUnsignedByte();
            }
        } else if (opcode === 26) {
            this.femaleModel1 = this.readModelId(buffer);
        } else if (opcode === 27) {
            this.op27 = buffer.readUnsignedByte();
        } else if (opcode >= 30 && opcode < 35) {
            this.groundActions[opcode - 30] = this.readString(buffer);
            if (this.groundActions[opcode - 30]?.toLowerCase() === "hidden") {
                this.groundActions[opcode - 30] = null;
            }
        } else if (opcode >= 35 && opcode < 40) {
            this.inventoryActions[opcode - 35] = this.readString(buffer);
        } else if (opcode === 40) {
            const count = buffer.readUnsignedByte();
            this.recolorFrom = new Array(count);
            this.recolorTo = new Array(count);

            for (let i = 0; i < count; i++) {
                this.recolorFrom[i] = buffer.readUnsignedShort();
                this.recolorTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 41) {
            const count = buffer.readUnsignedByte();
            this.retextureFrom = new Array(count);
            this.retextureTo = new Array(count);

            for (let i = 0; i < count; i++) {
                this.retextureFrom[i] = buffer.readUnsignedShort();
                this.retextureTo[i] = buffer.readUnsignedShort();
            }
        } else if (opcode === 42) {
            this.shiftClickIndex = buffer.readByte();
        } else if (opcode === 43 && this.cacheInfo.game === "oldschool") {
            // inventory subops (e.g. the amulet of glory's teleport list)
            buffer.readUnsignedByte();
            while (buffer.readUnsignedByte() !== 0) {
                this.readString(buffer);
            }
        } else if (opcode === 44) {
            if (this.cacheInfo.game === "oldschool" && this.cacheInfo.revision >= 237) {
                this.model = buffer.readInt();
            } else {
                buffer.readUnsignedShort();
            }
        } else if (opcode === 45) {
            if (this.cacheInfo.game === "oldschool" && this.cacheInfo.revision >= 237) {
                this.maleModel = buffer.readInt();
                this.maleOffset = buffer.readUnsignedByte();
            } else {
                buffer.readUnsignedShort();
            }
        } else if (opcode === 46) {
            this.maleModel1 = buffer.readInt();
        } else if (opcode === 47) {
            this.maleModel2 = buffer.readInt();
        } else if (opcode === 48) {
            this.femaleModel = buffer.readInt();
            this.femaleOffset = buffer.readUnsignedByte();
        } else if (opcode === 49) {
            this.femaleModel1 = buffer.readInt();
        } else if (opcode === 50) {
            this.femaleModel2 = buffer.readInt();
        } else if (opcode === 51) {
            this.maleHeadModel = buffer.readInt();
        } else if (opcode === 52) {
            this.maleHeadModel2 = buffer.readInt();
        } else if (opcode === 53) {
            this.femaleHeadModel = buffer.readInt();
        } else if (opcode === 54) {
            this.femaleHeadModel2 = buffer.readInt();
        } else if (opcode === 65) {
            this.stockmarket = true;
        } else if (opcode === 75) {
            this.op75 = buffer.readShort();
        } else if (opcode === 78) {
            this.maleModel2 = this.readModelId(buffer);
        } else if (opcode === 79) {
            this.femaleModel2 = this.readModelId(buffer);
        } else if (opcode === 90) {
            this.maleHeadModel = this.readModelId(buffer);
        } else if (opcode === 91) {
            this.femaleHeadModel = this.readModelId(buffer);
        } else if (opcode === 92) {
            this.maleHeadModel2 = this.readModelId(buffer);
        } else if (opcode === 93) {
            this.femaleHeadModel2 = this.readModelId(buffer);
        } else if (opcode === 94) {
            buffer.readUnsignedShort();
        } else if (opcode === 95) {
            this.zan2d = buffer.readUnsignedShort();
        } else if (opcode === 96) {
            const dummy = buffer.readUnsignedByte();
        } else if (opcode === 97) {
            this.note = buffer.readUnsignedShort();
        } else if (opcode === 98) {
            this.noteTemplate = buffer.readUnsignedShort();
        } else if (opcode >= 100 && opcode < 110) {
            if (!this.countObj) {
                this.countObj = new Array(10);
                this.countCo = new Array(10);
            }

            this.countObj[opcode - 100] = buffer.readUnsignedShort();
            this.countCo[opcode - 100] = buffer.readUnsignedShort();
        } else if (opcode === 110) {
            this.resizeX = buffer.readUnsignedShort();
        } else if (opcode === 111) {
            this.resizeY = buffer.readUnsignedShort();
        } else if (opcode === 112) {
            this.resizeZ = buffer.readUnsignedShort();
        } else if (opcode === 113) {
            this.ambient = buffer.readByte();
        } else if (opcode === 114) {
            this.contrast = buffer.readByte() * 5;
        } else if (opcode === 115) {
            this.team = buffer.readUnsignedByte();
        } else if (opcode === 121) {
            const lentId = buffer.readUnsignedShort();
        } else if (opcode === 122) {
            const lentTemplate = buffer.readUnsignedShort();
        } else if (opcode === 125) {
            const manwearxoff = buffer.readByte();
            const manwearyoff = buffer.readByte();
            const manwearzoff = buffer.readByte();
        } else if (opcode === 126) {
            const womanwearxoff = buffer.readByte();
            const womanwearyoff = buffer.readByte();
            const womanwearzoff = buffer.readByte();
        } else if (opcode === 127) {
            const cursor1op = buffer.readUnsignedByte();
            const cursor1 = buffer.readUnsignedShort();
        } else if (opcode === 128) {
            const cursor2op = buffer.readUnsignedByte();
            const cursor2 = buffer.readUnsignedShort();
        } else if (opcode === 129) {
            const cursor1iop = buffer.readUnsignedByte();
            const icursor1 = buffer.readUnsignedShort();
        } else if (opcode === 130) {
            const cursor2iop = buffer.readUnsignedByte();
            const icursor2 = buffer.readUnsignedShort();
        } else if (opcode === 132) {
            const count = buffer.readUnsignedByte();
            for (let i = 0; i < count; i++) {
                buffer.readUnsignedShort();
            }
        } else if (opcode === 139) {
            this.unnotedId = buffer.readUnsignedShort();
        } else if (opcode === 140) {
            this.notedId = buffer.readUnsignedShort();
        } else if (opcode >= 142 && opcode < 147) {
            buffer.readUnsignedShort();
        } else if (opcode === 148) {
            this.placeholder = buffer.readUnsignedShort();
        } else if (opcode === 149) {
            this.placeholderTemplate = buffer.readUnsignedShort();
        } else if (opcode >= 150 && opcode < 155) {
            buffer.readUnsignedShort();
        } else if (opcode === 160 && this.cacheInfo.game === "oldschool") {
            // never stacks
        } else if (opcode === 161 && this.cacheInfo.game === "oldschool") {
            // holding whitelist
            const count = buffer.readUnsignedShort();
            for (let i = 0; i < count; i++) {
                buffer.readUnsignedShort();
            }
        } else if (opcode === 200) {
            // subop
            buffer.readUnsignedByte();
            buffer.readUnsignedByte();
            buffer.readString();
        } else if (opcode === 201) {
            // multiop
            buffer.readUnsignedByte();
            buffer.readUnsignedShort();
            buffer.readUnsignedShort();
            buffer.readInt();
            buffer.readInt();
            buffer.readNullString();
        } else if (opcode === 202) {
            // multisubop
            buffer.readUnsignedByte();
            buffer.readUnsignedShort();
            buffer.readUnsignedShort();
            buffer.readUnsignedShort();
            buffer.readInt();
            buffer.readInt();
            buffer.readNullString();
        } else if (opcode === 249) {
            this.params = Type.readParamsMap(buffer, this.params);
        } else if (opcode === 251 && this.cacheInfo.game === "oldschool") {
            // bronzeman
        } else {
            throw new Error("ObjType: Opcode " + opcode + " not implemented.");
        }
    }

    genCert(template: ObjType, original: ObjType): void {
        this.model = template.model;
        this.zoom2d = template.zoom2d;
        this.xan2d = template.xan2d;
        this.yan2d = template.yan2d;
        this.zan2d = template.zan2d;
        this.offsetX2d = template.offsetX2d;
        this.offsetY2d = template.offsetY2d;
        this.recolorFrom = template.recolorFrom;
        this.recolorTo = template.recolorTo;
        this.retextureFrom = template.retextureFrom;
        this.retextureTo = template.retextureTo;
        this.name = original.name;
        this.isMembers = original.isMembers;
        this.tradeable = original.tradeable;
        this.price = original.price;
        this.stackability = ObjStackability.ALWAYS;
    }

    genBought(template: ObjType, original: ObjType): void {
        this.model = template.model;
        this.zoom2d = template.zoom2d;
        this.xan2d = template.xan2d;
        this.yan2d = template.yan2d;
        this.zan2d = template.zan2d;
        this.offsetX2d = template.offsetX2d;
        this.offsetY2d = template.offsetY2d;
        this.recolorFrom = original.recolorFrom;
        this.recolorTo = original.recolorTo;
        this.retextureFrom = original.retextureFrom;
        this.retextureTo = original.retextureTo;
        this.name = original.name;
        this.isMembers = original.isMembers;
        this.stackability = original.stackability;
        this.maleModel = original.maleModel;
        this.maleModel1 = original.maleModel1;
        this.maleModel2 = original.maleModel2;
        this.femaleModel = original.femaleModel;
        this.femaleModel1 = original.femaleModel1;
        this.femaleModel2 = original.femaleModel2;
        this.maleHeadModel = original.maleHeadModel;
        this.maleHeadModel2 = original.maleHeadModel2;
        this.femaleHeadModel = original.femaleHeadModel;
        this.femaleHeadModel2 = original.femaleHeadModel2;
        this.team = original.team;
        this.groundActions = original.groundActions;
        this.op75 = original.op75;
        this.inventoryActions = new Array(5);
        if (original.inventoryActions) {
            for (let i = 0; i < 4; i++) {
                this.inventoryActions[i] = original.inventoryActions[i];
            }
        }

        this.inventoryActions[4] = "Discard";
        this.price = 0;
        this.tradeable = false;
    }

    genPlaceholder(template: ObjType, original: ObjType): void {
        this.model = template.model;
        this.zoom2d = template.zoom2d;
        this.xan2d = template.xan2d;
        this.yan2d = template.yan2d;
        this.zan2d = template.zan2d;
        this.offsetX2d = template.offsetX2d;
        this.offsetY2d = template.offsetY2d;
        this.recolorFrom = template.recolorFrom;
        this.recolorTo = template.recolorTo;
        this.retextureFrom = template.retextureFrom;
        this.retextureTo = template.retextureTo;
        this.stackability = template.stackability;
        this.name = original.name;
        this.price = 0;
        this.isMembers = false;
        this.tradeable = false;
        this.stockmarket = false;
    }

    getCountObj(loader: ObjTypeLoader, count: number): ObjType {
        if (this.countObj && count > 1) {
            let newId = -1;

            for (let i = 0; i < 10; i++) {
                if (count >= this.countCo[i] && this.countCo[i] !== 0) {
                    newId = this.countObj[i];
                }
            }

            if (newId !== -1) {
                return loader.load(newId);
            }
        }

        return this;
    }

    getShiftClickIndex(): number {
        if (this.shiftClickIndex !== -1 && this.inventoryActions) {
            if (this.shiftClickIndex >= 0) {
                return this.inventoryActions[this.shiftClickIndex] ? this.shiftClickIndex : -1;
            } else {
                return this.inventoryActions[4] && this.inventoryActions[4].toLowerCase() === "drop"
                    ? 4
                    : -1;
            }
        } else {
            return -1;
        }
    }

    hasRecolor(): boolean {
        return !!this.recolorTo;
    }

    hasRetexture(): boolean {
        return !!this.retextureTo;
    }

    override post(): void {
        switch (this.id) {
            case 10555: // Penance skirt
                this.maleModel = 6667;
                this.model = 6595;
                this.recolorFrom = [10518, 10638, 10398, 61];
                this.recolorTo = [933, 14395, 924, 14387];
                break;
            case 3753: // Warrior helm
                this.maleModel1 = 4222;
                this.model = 4276;
                this.recolorFrom = [8386, 8390, 8394, 8526];
                this.recolorTo = [924, 933, 10398, 10518];
                break;
            case 3749: // Archer helm
                this.maleModel1 = 4223;
                this.model = 4277;
                this.recolorFrom = [8530, 8534, 8410, 8414];
                this.recolorTo = [22424, 22416, 21526, 21522];
                break;
            case 1377: // Dragon battleaxe
                this.maleModel = 550;
                this.model = 2778;
                this.recolorFrom = [61, 41, 57];
                this.recolorTo = [924, 920, 933];
                break;
            case 20727: // Leaf-bladed battleaxe
                this.maleModel = 6702;
                this.model = 6579;
                this.recolorFrom = [10291, 10299, 10514, 8481];
                this.recolorTo = [127, 10398, 61, 5161];
                break;
            case 28810: // Zombie axe
                this.maleModel = 6702;
                this.model = 6579;
                this.recolorFrom = [10291, 10299, 10514, 8481];
                this.recolorTo = [14395, 14387, 5161, 5276];
                break;
            case 20756: // Hill giant club
                this.maleModel = 9344;
                this.model = 9351;
                this.recolorFrom = [8, 24, 33];
                this.recolorTo = [5276, 5161, 8390];
                break;
            case 22370: // Bryophyta's staff
                this.maleModel = 6706;
                this.model = 6590;
                this.recolorFrom = [14503, 14499, 14494, 14490];
                this.recolorTo = [22424, 22416, 21526, 14395];
                break;
            case 9013: // Skull sceptre
                this.maleModel = 6232;
                this.model = 6235;
                this.recolorFrom = [55180, 28];
                this.recolorTo = [8390, 5161];
                break;
            case 21276: // Skull sceptre (i)
                this.maleModel = 6232;
                this.model = 6235;
                this.recolorFrom = [55180, 28];
                this.recolorTo = [924, 8390];
                break;
            case 25739: // Sanguine Scythe of Vitur
                this.maleModel = 35371;
                this.model = 35742;
                this.recolorFrom = [16, 24, 536, 28, 78, 790, 796, 784];
                this.recolorTo = [924, 920, 933, 916, 943, 924, 933, 916];
                break;
            case 26233: // Ancient godsword
                this.maleModel = 27653;
                this.model = 28060;
                this.recolorFrom = [26, 920, 35, 30, 43059, 43092];
                this.recolorTo = [49189, 47275, 51111, 49189, 43117, 10388];
                break;
            case 29577: // Burning claws
                this.maleModel = 29191;
                this.model = 32784;
                this.recolorFrom = [929, 922, 918, 914];
                this.recolorTo = [6080, 5056, 7104, 8128];
                break;
            case 21003: // Elder maul
                this.maleModel = 9344;
                this.model = 9351;
                this.recolorFrom = [24, 8, 33];
                this.recolorTo = [10318, 924, 10334];
                break;
            case 21015: // Dinh's bulwark
                this.maleModel = 26423;
                this.model = 26457;
                this.recolorFrom = [74, 41, 37, 49, 33, 57];
                this.recolorTo = [10398, 10518, 8128, 10398, 10518, 7104];
                break;
            case 28682: // Dinh's blazing bulwark
                this.maleModel = 26423;
                this.model = 26457;
                this.recolorFrom = [74, 41, 37, 49, 33, 57];
                this.recolorTo = [6080, 924, 7104, 5056, 920, 8128];
                break;
            case 30388: // Thunder khopesh
                this.maleModel = 6031;
                this.model = 6033;
                this.recolorFrom = [37, 933, 935];
                this.recolorTo = [8128, 37999, 43129];
                break;
            case 28540: // Corrupted twisted bow
                this.maleModel = 32674;
                this.model = 32799;
                this.recolorFrom = [24, 16, 8, 33, 13223, 10318, 10334, 14236];
                this.recolorTo = [924, 920, 912, 933, 960, 10398, 10518, 943];
                break;
            case 28547: // Corrupted tumeken's shadow
                this.maleModel = 45281;
                this.model = 46465;
                this.recolorFrom = [7116, 4044, 7099, 941, 3001, 6082, 908, 8152];
                this.recolorTo = [924, 920, 933, 49189, 916, 47275, 960, 51111];
                break;
            case 24425: // Eldritch Nightmare staff
                this.maleModel = 39058;
                this.model = 39070;
                this.recolorFrom = [61718, 61838, 61598];
                this.recolorTo = [22424, 22416, 21526];
                break;
            case 25731: // Holy sanguinesti staff
                this.maleModel = 35372;
                this.model = 35744;
                this.recolorFrom = [3127, 24, 28, 156, 20, 3140, 49, 142];
                this.recolorTo = [8128, 10351, 11177, 37999, 10351, 7104, 127, 37999];
                break;
        }
    }
}
