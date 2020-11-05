"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const rimraf_1 = __importDefault(require("rimraf"));
const l = console.log;
const err = console.error;
const renderOutputDir = path_1.join(process.cwd(), 'tempDir');
const bookEpub = path_1.join(renderOutputDir, 'book.epub');
const testBookGenScript = (path_1.join(process.cwd(), 'test'));
describe('initial test', () => {
    describe('rendering', () => {
        beforeEach(() => {
            if (fs_1.existsSync(renderOutputDir))
                rimraf_1.default(renderOutputDir, { maxBusyTries: 5 }, l);
        });
        beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
            return yield new Promise(resolve => {
                let bookGenRes = child_process_1.fork(testBookGenScript);
                bookGenRes.on('message', (c, s) => l({ c, s }));
                bookGenRes.on('error', (e) => err({ e }));
                bookGenRes.on('close', (c, s) => resolve(bookGenRes));
            });
        }));
        it('test epub should be (re)generated', () => __awaiter(void 0, void 0, void 0, function* () {
            expect(fs_1.existsSync(bookEpub)).toBeTruthy();
        }));
    });
});
