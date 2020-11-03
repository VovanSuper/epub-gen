import { join } from 'path';
import { execSync, fork } from 'child_process';
import { existsSync, unlinkSync } from 'fs';
import rimraf from 'rimraf';

const l = console.log;
const err = console.error;

const renderOutputDir = join(process.cwd(), 'tempDir');
const bookEpub = join(renderOutputDir, 'book.epub');
const testBookGenScript = (join(process.cwd(), 'test'));

describe('initial test', () => {

  describe('rendering', () => {

    beforeEach(() => {
      if (existsSync(renderOutputDir))
        rimraf(renderOutputDir, { maxBusyTries: 5 }, l);
    });
    beforeEach(async () => {
      return await new Promise(async resolve => {
        let bookGenRes = await fork(testBookGenScript);
        bookGenRes.on('message', (c, s) => l({ c, s }));
        bookGenRes.on('error', (e) => err({ e }));
        bookGenRes.on('close', (c, s) => resolve(bookGenRes));
      });
    });


    it('temp dir shouldnt exist', async () => {
      expect(existsSync(bookEpub)).toBeTruthy();
    });
  });

});