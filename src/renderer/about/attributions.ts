/**
 * Upstream sources credited in the About dialog.
 *
 * Mirrors `packages/resource-compiler/LICENSES.md`. Some of these attributions
 * are licence obligations rather than courtesies — CC BY 4.0 requires credit —
 * so entries marked `required` must not be removed without checking that file.
 */
export interface Attribution {
  name: string;
  url: string;
  what: string;
  licence: string;
  required: boolean;
}

export const RESOURCE_ATTRIBUTIONS: readonly Attribution[] = [
  {
    name: 'STEP Bible',
    url: 'https://www.STEPBible.org',
    what: 'Versification traditions (TVTMS), curated by STEPBible from work by Tyndale House, Cambridge',
    licence: 'CC BY 4.0',
    required: true,
  },
  {
    name: 'OpenBible.info',
    url: 'https://www.openbible.info',
    what: 'Cross-reference data, drawn largely from the Treasury of Scripture Knowledge',
    licence: 'CC BY 4.0',
    required: true,
  },
  {
    name: 'Christian Classics Ethereal Library',
    url: 'https://www.ccel.org',
    what: 'Source of the public-domain commentary texts',
    licence: 'Public domain texts',
    required: false,
  },
  {
    name: 'Berean Standard Bible',
    url: 'https://berean.bible',
    what: 'Produced in cooperation with Bible Hub, Discovery Bible, OpenBible.com and the Berean Bible Translation Committee',
    licence: 'Public domain (CC0 1.0)',
    required: false,
  },
  {
    name: 'eBible.org',
    url: 'https://ebible.org',
    what: 'World English Bible and other public-domain translations',
    licence: 'Public domain',
    required: false,
  },
];

export const LIBRARIES_NOTE =
  'Built with Electron, React and SQLite, and released under the GNU General Public License, version 3 or later.';
