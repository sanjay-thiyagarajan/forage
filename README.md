# Forage

## Overview

The standard Wikidata/Wikibase editing interface is comprehensive, but not that user-friendly. When looking at a page, it is difficult to know any of the following:
- Which information that would be expected for this type of entity is missing
- The right property to use for each such piece of information (for example, "country" vs. "country of origin")
- Conversely, which properties found on this page do ''not'' belong, and should probably be removed, or replaced

Forage is a user script that provides an additional editing interface that makes editing easier, by showing the expected properties for a page (based on its "instance of" values), and providing simple inputs to let users add values for any such property.

It should be noted that Forage is meant to _complement_, not replace, the existing Wikidata/Wikibase editing interface. There are many types of editing that can only be done with the standard interface, and not with Forage. Forage, for example, cannot add qualifiers or references for property values. Also, Forage does not allow for editing or removing existing data - only for adding new data. This was a design decision done on purpose, to make Forage a "safer" editing environment. Editing or removing data should often involve looking at the page history (and doing a revert), modifying references, etc.: these are best done through the main editing interface, not a simplified one.

## Installation

To install Forage, just add the following line to the common.js subpage under your user page on Wikidata, i.e. wikidata.org/wiki/User:_Your username here_/common.js:
```
importScript('User:Techwizzie/forage.js');
```

## Authors

Forage was created by Sanjay Thiyagarajan, Naresh Kumar and Yaron Koren, based on a design by Yaron.

## Usage

Once you install Forage, you will see a new tab, "Add property values", that looks like this:

[screenshot]

Clicking on it will show a display that looks like this:

[screenshot]

By default, the entire set of identifier/ID fields is minimized; if you click on "External ID(s)", you will see even more fields:

[screenshot]

To add a value for any property, click on the "+" next to that property name; this will add a display like the following, though the exact input will depend on the property type:

[screenshot]

Clicking "publish" will add the value to the page, and the display:

[screenshot]
