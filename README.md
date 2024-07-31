# Forage

## Overview

The standard Wikidata/Wikibase editing interface is comprehensive, but not that user-friendly. When looking at a page, it is difficult to know any of the following:
- Which information that would be expected for this type of entity is missing
- The right property to use for each such piece of information (for example, "country" vs. "country of origin")
- Conversely, which properties found on this page do ''not'' belong, and should probably be removed, or replaced

Forage is a user script that provides an additional editing interface that makes editing easier, by showing the expected properties for a page (based on its "instance of" values), and providing simple inputs to let users add values for any such property.

It should be noted that Forage is meant to _complement_, not replace, the existing Wikidata/Wikibase editing interface. There are many types of editing that can only be done with the standard interface, and not with Forage. Forage, for example, cannot add qualifiers or references for property values. Also, Forage does not allow for editing or removing existing data - only for adding new data. The fact that it is add-only was a design decision done on purpose, to make Forage a "safer" editing environment. Editing or removing data should often involve looking at the page history (and doing a revert), modifying references, etc.: these are best done through the main editing interface, not a simplified one.

## Installation

To install Forage, just add the following line to the common.js subpage under your user page on Wikidata, i.e. wikidata.org/wiki/User:_Your username here_/common.js:
```
importScript('User:Techwizzie/forage.js');
```

## Authors

Forage was created by Sanjay Thiyagarajan, Naresh Kumar and Yaron Koren, based on a design by Yaron.

## License

Forage is open-source software that uses the [MIT license](https://opensource.org/license/mit).

## Usage

Once you install Forage, on every page in the main namespace you will see a new tab, "Add property values", that looks like this:

!["Add property values" tab](https://github.com/sanjay-thiyagarajan/forage/blob/main/images/Forage-tab-display.png)

Clicking on it will show a display that looks like this:

![Forage main display](https://github.com/sanjay-thiyagarajan/forage/blob/main/images/Forage-main-display.png)

Properties are shown in alphabetical order, by "class". This is done by querying three different Wikidata/Wikibase properties:
- "[instance of](https://www.wikidata.org/wiki/Property:P31)" is used to get the main class, or classes, of this page.
- "[subclass of](https://www.wikidata.org/wiki/Property:P279)" is used to get all the "superclasses" of this initial set of classes - since this page can presumably be defined to belong to those classes as well.
- "[properties for this type](https://www.wikidata.org/wiki/Property:P1963)" is used to get all the properties that are to be expected for any specific class. (If the same property is defined for more than one of those classes, it will only be displayed the first time it is encountered.)

Note that "instance of" cannot be set by the Forage interface - this property, at least, has to be set before you can edit a new page.

Scrolling further down the interface, you can see properties for the additional classes:

![Properties for additional classes](https://github.com/sanjay-thiyagarajan/forage/blob/main/images/Forage-additional-classes.png)

If the page has any properties defined for it that are not specified for any of these classes, they will show up below all the classes, in a grouping titled "Other fields":

![Other fields display](https://github.com/sanjay-thiyagarajan/forage/blob/main/images/Forage-other-fields.png)

The class and field listings shown above include all properties except for the so-called "identifier" or "ID" properties. These are displayed separately, in a section at the bottom of the page that is minimized by default. If you click on "External IDs", you will see all of these additional fields, again split up by class:

![External IDs listing](https://github.com/sanjay-thiyagarajan/forage/blob/main/images/Forage-external-IDs.png)

To add a value for a property of any type, click on the "+" next to that property name; this will add a display like the following, though the exact input will depend on the property type:

![Forage combobox input](https://raw.githubusercontent.com/sanjay-thiyagarajan/forage/main/images/Forage-combobox-input.png)

Clicking "publish" will add the value to the page, and the display:

![Post-save display](https://github.com/sanjay-thiyagarajan/forage/blob/main/images/Forage-post-save.png)

After adding values, you can then use the main Wikidata/Wikibase display to add additional information; every "claim" should ideally have a reference, and some should have qualifiers as well:

![Adding additional information via main interface](https://raw.githubusercontent.com/sanjay-thiyagarajan/forage/main/images/Forage-additional-info.png)

## Translation

Forage defines various internationalization (i18n) messages, which can be seen near the top of the forage.js file. Currently these are defined only for English, but patches are welcome to add translations into other languages. Eventually, if possible, it would be good if the translations could be split off into separate JSON files for each language, in the standard MediaWiki style, so that translations could be provided by the community at translatewiki.net.

## Usage outside Wikidata

In theory, Forage can be used in any Wikibase installation, not just Wikidata, as long as the installation contains (and uses) properties equivalent to the following: "instance of", "subclass of", "properties for this type", "point in time", "start time" and "end time". If it does, then using Forage is just a matter of copying over the script into some local page on the Wikibase-using wiki, then changing the values of the constants for these six properties (e.g., `instanceOfItemID`), from their current value (e.g., "P31") to their local property IDs on that wiki.
