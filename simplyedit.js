messages = {
  en: {
    "menu-title": "Edit Properties",
    "fields-for-class-title": "Fields for class",
    "other-fields-title": "Other fields",
    "external-ids-title": "External ID(s)",
  },
};

mw.messages.set(messages["en"]);
var lang = mw.config.get("wgUserLanguage");
if (lang && lang != "en" && lang in messages) {
  mw.messages.set(messages[lang]);
}

mw.loader.using("@wikimedia/codex").then(function (require) {
  const Vue = require("vue");
  const Codex = require("@wikimedia/codex");
  const instanceOfItemID = "P31";
  const propertiesForTypeID = "P1963";
  const subClassOfID = "P279";
  const pointInTimeID = "P585";
  const startTimeID = "P580";
  const endTimeID = "P582";
  var statementsMap = {};
  var newStatementsMap = {};
  var allProperties = [];
  var allPropertyLabels = [];
  var allClassLabels = {};
  var claimGUIDsToRemove = [];
  var statementsToCreate = [];
  var propertiesForClasses = {};
  var instancesOf = [];
  var allPropIDLabelsMap = {
    "": "",
  };
  var propertyDatatypeMap = {};
  var classIDList = [];
  var menuList = $("#right-navigation").find(".vector-menu-content-list");
  var editEntityDiv = $("<li>").attr({
    id: "ca-edit-entity",
    class: "vector-tab-noicon mw-list-item",
  });

  var editFieldSpan = $("<span>").text(mw.msg("menu-title"));
  var anchor = $("<a>").append(editFieldSpan);
  anchor.on("click", function () {
    var wbrepo = mw.config.get("wbRepo");
    window.location.href =
      wbrepo.url +
      wbrepo.articlePath.replace("$1", mw.config.get("wgTitle")) +
      "?editproperties";
  });

  if (mw.config.get("wgPageContentModel") === "wikibase-item") {
    editEntityDiv.append(anchor);
    menuList.append(editEntityDiv);
    const queryString = window.location.search;
    if (queryString.includes("?editproperties")) {
      // Active tab switching
      menuList.find("li").each(function () {
        $(this).removeClass("selected");
      });
      $("#ca-edit-entity").addClass("selected");

      // Function to retrieve instance of properties
      function getInstanceOfProperties(entity) {
        var instancesOf = [];
        if (entity.claims[instanceOfItemID]) {
          entity.claims[instanceOfItemID].forEach(function (val) {
            instancesOf.push(val.mainsnak.datavalue.value.id);
          });
        }
        return instancesOf;
      }

      // Function to retrieve values map
      function setStatementsMap(entity, propertyIDs) {
        propertyIDs.forEach(function (propertyID) {
          if (entity.claims[propertyID]) {
            statementsMap[propertyID] = entity.claims[propertyID];
          }
        });
      }

      async function getParentClasses(instancesOf) {
        if (instancesOf.length === 0) {
          return [];
        }

        let newIds = instancesOf.filter(function (val) {
          return !classIDList.includes(val);
        });

        classIDList = classIDList.concat(newIds);

        const api = new mw.Api();

        const requestParams = {
          action: "wbgetentities",
          format: "json",
          ids: newIds,
          language: lang,
        };
        try {
          const res = await api.get($.extend({}, requestParams));
          var parentIDs = new Set();
          for (const itemID of newIds) {
            if (res.entities[itemID].claims[subClassOfID] !== undefined) {
              const parentClasses = res.entities[itemID].claims[subClassOfID];
              parentClasses.forEach(async function (classValue) {
                if (
                  classValue.mainsnak.snaktype !== "novalue" &&
                  classValue.rank !== "deprecated"
                ) {
                  parentIDs.add(classValue.mainsnak.datavalue.value.id);
                }
              });
            }
          }
          await getParentClasses(Array.from(parentIDs));
        } catch (error) {
          console.error("API call failed: ", error);
        }
      }

      // Helper function to chunk an array into smaller arrays
      function chunkArray(array, size) {
        return Array.from(
          { length: Math.ceil(array.length / size) },
          function (_, index) {
            return array.slice(index * size, index * size + size);
          }
        );
      }

      // Function to retrieve class properties from Wikidata API
      function retrieveClassProperties(
        api,
        requestParams,
        instancesOf,
        entity
      ) {
        return new Promise(async function (resolve, reject) {
          var instanceOfBatches = chunkArray(instancesOf, 50);
          var promises = instanceOfBatches.map(function (instanceBatch) {
            return new Promise(function (innerResolve, innerReject) {
              var requestParams = {
                action: "wbgetentities",
                format: "json",
                ids: instanceBatch,
              };
              let typesResponse = api.get(requestParams);
              typesResponse.done(function (res) {
                let entities = res.entities;
                let typePropertyMap = {};
                let allPropIDs = new Set();
                instanceBatch.forEach(function (instance) {
                  let et = entities[instance];
                  if (!propertiesForClasses[instance]) {
                    propertiesForClasses[instance] = [];
                  }
                  if (et.claims[propertiesForTypeID]) {
                    et.claims[propertiesForTypeID].forEach(function (val) {
                      var snakType = val.mainsnak.snaktype;
                      if (snakType == "novalue" || snakType == "somevalue") {
                        return;
                      }
                      let propertyID = val.mainsnak.datavalue.value.id;
                      if (allPropIDs.has(propertyID)) {
                        return;
                      }
                      propertiesForClasses[instance].push(propertyID);
                      typePropertyMap[propertyID] = instance;
                      allPropIDs.add(propertyID);
                    });
                  }
                });
                let propertyIDsForCurrentClassBatch = Array.from(allPropIDs);
                // Remove "instance of" value(s)
                propertyIDsForCurrentClassBatch.splice(
                  propertyIDsForCurrentClassBatch.indexOf(instanceOfItemID),
                  1
                );
                setStatementsMap(entity, propertyIDsForCurrentClassBatch);
                retrieveLabels(
                  api,
                  propertyIDsForCurrentClassBatch,
                  instanceBatch
                ).then(function (labelsResult) {
                  allProperties = allProperties.concat(
                    labelsResult.allProperties
                  );
                  Object.assign(allClassLabels, labelsResult.allClassLabels);
                  innerResolve();
                });
              });
            });
          });

          var propertyIDsForThisPage = Object.keys(entity.claims);
          // Remove "instance of" value(s)
          propertyIDsForThisPage.splice(
            propertyIDsForThisPage.indexOf(instanceOfItemID),
            1
          );
          setStatementsMap(entity, propertyIDsForThisPage);

          var batchedPropertyIDsForThisPage = chunkArray(
            propertyIDsForThisPage,
            50
          );
          var propertyLabelPromises = batchedPropertyIDsForThisPage.map(
            function (curPropertyIDsBatch) {
              return new Promise(async function (innerResolve, innerReject) {
                var requestParams = {
                  action: "wbgetentities",
                  format: "json",
                  ids: curPropertyIDsBatch,
                  language: lang,
                };

                var result = await api.get(requestParams);
                allProps = Object.entries(result.entities).map(function ([
                  propID,
                  value,
                ]) {
                  propertyDatatypeMap[propID] = value.datatype;
                  //let propertyIDs = Object.keys(value.claims);
                  //setStatementsMap(value, propertyIDs);
                  return {
                    id: propID,
                    datatype: value.datatype,
                    label: value.labels[lang].value,
                  };
                });
                allProperties = allProperties.concat(allProps);
                innerResolve();
              });
            }
          );

          // Wait for all promises to resolve and process the results
          Promise.all(promises)
            .then(function (_) {
              Promise.all(propertyLabelPromises)
                .then(function (_) {
                  resolve();
                })
                .catch(function (error) {
                  console.error("Error fetching labels:", error);
                });
            })
            .catch(function (error) {
              console.error("Error fetching labels:", error);
            });
        });
      }

      function fetchPropertyLabels(api, properties, instancesOf) {
        var lang = mw.config.get("wgUserLanguage");
        var requestParams = {
          action: "wbgetentities",
          format: "json",
        };
        // Group properties into batches of 50 or fewer
        var propertyBatches = chunkArray(properties, 50);

        return new Promise(function (resolve, reject) {
          // Create promises for each batch and make asynchronous requests
          var promises = propertyBatches.map(function (propertyBatch) {
            var propertyBatchIDs = [];
            propertyBatch.map(function (prop) {
              propertyBatchIDs.push(prop.id);
            });
            // Fetch labels for the current batch of properties
            var labelsResponse = api.get(
              $.extend({}, requestParams, {
                props: "labels",
                ids: propertyBatchIDs,
              })
            );
            return labelsResponse.then(function (res) {
              var props = res.entities;
              var properties = [];
              var classLabelsBatch = {};
              // Process each property in the batch
              propertyBatchIDs.forEach(function (propID) {
                var prop = props[propID];
                if (prop) {
                  if (instancesOf.indexOf(prop.id) === -1) {
                    properties.push({
                      id: prop.id,
                      datatype: prop.datatype,
                      label: prop.labels[lang] ? prop.labels[lang].value : "",
                    });
                  } else {
                    classLabelsBatch[prop.id] = prop.labels[lang]
                      ? prop.labels[lang].value
                      : "";
                  }
                }
              });
              return {
                properties: properties,
                classLabelsBatch: classLabelsBatch,
              };
            });
          });

          // Wait for all promises to resolve and process the results
          Promise.all(promises)
            .then(function (results) {
              var props = [];

              // Merge the results
              results.forEach(function (result) {
                props = props.concat(result.properties);
              });
              allPropertyLabels = props;
              resolve();
            })
            .catch(function (error) {
              console.error("Error fetching labels:", error);
            });
        });
      }

      // Function to retrieve labels from Wikidata API
      async function retrieveLabels(api, propertyIDs, instancesOf) {
        var lang = mw.config.get("wgUserLanguage");
        var requestParams = {
          action: "wbgetentities",
          format: "json",
          language: lang,
        };
        var batchSize = 50; // Maximum number of IDs per request
        var chunks = [];
        var i, j;

        // Split propertyIDs and instancesOf into chunks of batchSize
        for (i = 0, j = propertyIDs.length; i < j; i += batchSize) {
          chunks.push(propertyIDs.slice(i, i + batchSize));
        }
        for (i = 0, j = instancesOf.length; i < j; i += batchSize) {
          chunks.push(instancesOf.slice(i, i + batchSize));
        }
        // Create promises for each chunk and make asynchronous requests
        var promises = chunks.map(function (chunk) {
          var labelsResponse = api.get(
            $.extend({}, requestParams, { props: "labels", ids: chunk })
          );
          return labelsResponse.then(function (res) {
            var props = res.entities;
            var properties = [];
            var classLabels = {};
            Object.keys(props).forEach(function (idx) {
              var prop = props[idx];
              if (instancesOf.indexOf(prop.id) === -1) {
                properties.push({
                  id: prop.id,
                  datatype: prop.datatype,
                  label: prop.labels[lang] ? prop.labels[lang].value : "",
                });
              } else {
                classLabels[prop.id] = prop.labels[lang]
                  ? prop.labels[lang].value
                  : "";
              }
              propertyDatatypeMap[prop.id] = prop.datatype;
            });

            return { properties: properties, classLabels: classLabels };
          });
        });

        // Wait for all promises to resolve and process the results
        try {
          const results = await Promise.all(promises);
          var allProperties = [];
          var allClassLabels = {};

          // Merge the results
          results.forEach(function (result) {
            allProperties = allProperties.concat(result.properties);
            Object.assign(allClassLabels, result.classLabels);
          });
          return { allProperties, allClassLabels };
        } catch (error) {
          console.error("Error fetching labels:", error);
        }
      }

      function deleteValue(idx, propID) {
        let guid = this.statementsMap[propID][idx].id;
        if (guid !== undefined) {
          claimGUIDsToRemove.push(guid);
        }
        this.statementsMap[propID].splice(idx, 1);
      }

      /**
       * Format search results for consumption by TypeaheadSearch.
       *
       * @param pages
       * @return
       */
      function adaptApiResponse(pages) {
        return pages.map(
          ({
            id,
            label,
            url,
            match,
            description,
            display = {},
            thumbnail,
          }) => ({
            value: id,
            label,
            match: match.type === "alias" ? `(${match.text})` : "",
            description,
            url,
            language: {
              label: display && display.label && display.label.language,
              match: match.type === "alias" ? match.language : undefined,
              description:
                display && display.description && display.description.language,
            },
            thumbnail: thumbnail
              ? {
                  url: thumbnail.url,
                  width: thumbnail.width,
                  height: thumbnail.height,
                }
              : undefined,
          })
        );
      }

      function submitChanges() {
        console.log("Claims to remove: ", claimGUIDsToRemove);
        // var api = new mw.Api();
        // var requestParams = {
        //   action: 'wbremoveclaims',
        //   format: 'json',
        //   claim: claimGUIDsToRemove
        // };
        // var resp = api.get(requestParams);
        // resp.done(function(){
        //   location.reload();
        // });
      }

      function parseTimeValue(timeValue) {
        var timeString = timeValue.time.replace("+", "");
        var precision = timeValue.precision;
        // We really only worry about two precisions: full date (11) and year-only (9).
        // i.e., if it's not a full date, display a year.
        if (precision >= 11) {
          var dateObj = new Date(timeString);
          // @TODO Display the date in the way Wikibase does, with the month in the language of the user.
          var monthNum = dateObj.getMonth() + 1;
          var dayNum = dateObj.getDate() + 1;
          return (
            dateObj.getFullYear() +
            "-" +
            ("0" + monthNum).slice(-2) +
            "-" +
            ("0" + dayNum).slice(-2)
          );
        } else {
          // JS date parsing won't work on a date that looks like "YYYY-00-00",
          // so instead just get the first group of digits.
          var matches = timeString.match(/(\d+)/);
          return matches[0];
        }
      }

      function parseValue(statement) {
        var curValue = statement.mainsnak.datavalue.value;
        var str;
        if (curValue.id) {
          // entity
          str = allPropIDLabelsMap[curValue.id];
          if (str == "") {
            str = curValue.id;
          }
          let wbrepo = mw.config.get("wbRepo");
          let entityURL =
            wbrepo.url + wbrepo.articlePath.replace("$1", curValue.id);
          str = '<a href="' + entityURL + '" target="_blank">' + str + "</a>";
        } else if (curValue.amount) {
          // number or quantity
          // Remove "+" if it's there, and add thousands separators.
          // @TODO - this should use the MediaWiki settings, not the browser locale.
          str = Number(curValue.amount).toLocaleString(undefined, {
            maximumFractionDigits: 15,
          });
          //if (curValue.unit !== "1") {
          // quantity
          // @TODO curValue.unit is a Wikidata URL, so retrieve the unit name from there, and display it.
          //}
        } else if (curValue.time) {
          // time
          str = parseTimeValue(curValue);
        } else if (curValue.latitude && curValue.longitude) {
          // coordinates ("globe-coordinate")
          str = "(" + curValue.latitude + ", " + curValue.longitude + ")";
          str =
            '<a href="https://geohack.toolforge.org/geohack.php?params=' +
            curValue.latitude +
            "_N_" +
            curValue.longitude +
            '_E" target="_blank">' +
            str +
            "</a>";
        } else if (curValue.text) {
          // monolingual text
          str = curValue.text;
          if (curValue.language) {
            str += " (" + curValue.language + ")";
          }
        } else if (statement.mainsnak.datatype == "commonsMedia") {
          // file
          let wbrepo = mw.config.get("wbRepo");
          let entityURL =
            wbrepo.url + wbrepo.articlePath.replace("$1", "File:" + curValue);
          str =
            '<a href="' + entityURL + '" target="_blank">' + curValue + "</a>";
        } else {
          // string, external ID etc. - or just a malformed value?
          str = curValue;
        }

        // If there's a time-based qualifier for this value, display that/those within parentheses.
        if (statement.qualifiers) {
          if (statement.qualifiers[pointInTimeID]) {
            var pointInTime =
              statement.qualifiers[pointInTimeID][0].datavalue.value;
            str += " (" + parseTimeValue(pointInTime) + ")";
          } else if (
            statement.qualifiers[startTimeID] ||
            statement.qualifiers[endTimeID]
          ) {
            var startTime = statement.qualifiers[startTimeID]
              ? parseTimeValue(
                  statement.qualifiers[startTimeID][0].datavalue.value
                )
              : "";
            var endTime = statement.qualifiers[endTimeID]
              ? parseTimeValue(
                  statement.qualifiers[endTimeID][0].datavalue.value
                )
              : "";
            str += " (" + startTime + " - " + endTime + ")";
          }
        }
        return str;
      }

      // Function to retrieve labels from Wikidata API
      function fetchEntityAndQualifierLabels(api, entityIDs) {
        var lang = mw.config.get("wgUserLanguage");
        var batchSize = 50; // Maximum number of IDs per request
        var chunks = [];
        var requestParams = {
          action: "wbgetentities",
          format: "json",
        };
        var i, j;

        // Split entityIDs into chunks of batchSize
        for (i = 0, j = entityIDs.length; i < j; i += batchSize) {
          chunks.push(entityIDs.slice(i, i + batchSize));
        }
        // Create promises for each chunk and make asynchronous requests
        var promises = chunks.map(function (chunk) {
          var labelsResponse = api.get(
            $.extend({}, requestParams, { props: "labels", ids: chunk })
          );
          return labelsResponse.then(function (res) {
            var props = res.entities;
            var labels = {};
            Object.keys(props).forEach(function (idx) {
              var prop = props[idx];
              labels[prop.id] = prop.labels[lang]
                ? prop.labels[lang].value
                : "";
            });

            return { propIDLabelMap: labels };
          });
        });

        // Wait for all promises to resolve and process the results
        return Promise.all(promises)
          .then(function (results) {
            // Merge the results
            results.forEach(function (result) {
              Object.assign(allPropIDLabelsMap, result.propIDLabelMap);
            });
            return allPropIDLabelsMap;
          })
          .catch(function (error) {
            console.error("Error fetching labels:", error);
          });
      }

      Vue.createMwApp({
        data: function () {
          return {
            name: "SimplyEdit",
            classDivStyle:
              "border-style:solid; width: 80%; border-width:0.5px; padding: 0 1rem 1rem 1rem; margin-top: 1rem;background: aliceblue;",
            classHeaderStyle: "font-size: 15px;font-weight: bold;",
            qualifierLabelStyle: "font-size: 12px; text-decoration: italic;",
            valueTagStyle:
              "display: inline-block; font-size: 13px; padding: 3px 10px; border: 1px solid #999; background: lightyellow; border-radius: 10px; margin: 0 8px 6px 0;",
            classIDs: [],
            classLabels: {},
            properties: [],
            classPropertiesMap: {},
            otherPropertiesMap: {},
            statementsMap: {},
            progress: true,
            autocompleteItems: [],
            existingValueLabels: {},
            newStatementsMap: {},
            mw,
            allPropIDLabelsMap,
            deleteValue,
            submitChanges,
            parseValue,
          };
        },
        template: `
        <div>
          <cdx-progress-bar style="margin-top: 30px; width: 80%" v-if="progress" aria--label="ProgressBar"></cdx-progress-bar>
          <template v-if="!progress" v-for="classID in classIDs">
            <cdx-accordion v-if="classPropertiesMap[classID]['general'].length > 0 || classPropertiesMap[classID]['external'].length > 0" :style="classDivStyle">
              <template #title>{{mw.msg('fields-for-class-title')}} <a :href=getWikibaseURL(classID) target="_blank">{{classLabels[classID]}}</a></template>
              <cdx-field style="max-width: max-content;" v-for="propID in classPropertiesMap[classID]['general']">
                <template #label>
                  {{properties[propID].label}}
                  <cdx-button @click="addNewValue(propID)">+</cdx-button>
                </template>
                <cdx-field style="width: max-content;" v-for="(statement, idx) in newStatementsMap[propID]" :key="idx" style="display: flex; flex-direction: row;">
                  <cdx-typeahead-search
                    id="'typeahead-search-' + idx"
                    v-if="properties[propID].datatype === 'wikibase-item' && !(statement.references || statement.qualifiers) && (statement.mainsnak.snaktype !== 'novalue')"
                    :initial-input-value="allPropIDLabelsMap[statement.mainsnak.datavalue.value.id]"
                    placeholder="Type or choose an option"
                    search-results-label="Search results"
                    :search-results="autocompleteItems"
                    :show-thumbnail="true"
                    :highlight-query="true"
                    :visible-item-limit="5"
                    @input="comboboxOnChange($event, propID)"
                    @search-result-click="comboboxOnSelect"
                    @blur="resetOptions"
                  ></cdx-typeahead-search>
                  <cdx-text-input
                    v-if="(properties[propID].datatype === 'commonsMedia' || properties[propID].datatype === 'string') && !(statement.references || statement.qualifiers) && (statement.mainsnak.snaktype !== 'novalue')"
                    v-model="statement.mainsnak.datavalue.value"
                  ></cdx-text-input>
                  <cdx-text-input
                    v-if="properties[propID].datatype === 'quantity' && !(statement.references || statement.qualifiers) && (statement.mainsnak.snaktype !== 'novalue')"
                    v-model="statement.mainsnak.datavalue.value.amount"
                  ></cdx-text-input>
                  <cdx-text-input
                    v-if="properties[propID].datatype === 'time' && !(statement.references || statement.qualifiers) && (statement.mainsnak.snaktype !== 'novalue')"
                    v-model="statement.mainsnak.datavalue.value.time"
                    input-type="datetime-local"
                  ></cdx-text-input>
                </cdx-field>
                <span :style="valueTagStyle" v-for="(statement, idx) in statementsMap[propID]" :key="idx" v-html="parseValue(statement)"></span>
              </cdx-field>
              <br>
              <cdx-accordion style="background: white; border: 1px solid #ccc;" v-if="classPropertiesMap[classID]['external'].length > 0">
                <template #title>{{mw.msg('external-ids-title')}}</template>
                <cdx-field style="width: max-content;" v-for="propID in classPropertiesMap[classID]['external']">
                  <template #label>
                    {{properties[propID].label}}
                    <cdx-button @click="addNewValue(propID)">+</cdx-button>
                  </template>
                  <span :style="valueTagStyle" v-for="(statement, idx) in statementsMap[propID]" :key="idx">
                  {{parseValue(statement)}}
                  </span>
                </cdx-field>
              </cdx-accordion>
            </cdx-accordion>
          </template>
          <cdx-accordion :style="classDivStyle" v-if="!progress && (otherPropertiesMap['general'].length > 0 || otherPropertiesMap['external'].length > 0)">
            <template #title>{{mw.msg('other-fields-title')}}</template>
            <cdx-field style="width: 80%;" v-for="propID in otherPropertiesMap['general']">
              <template #label>
                {{properties[propID].label}}
                <cdx-button @click="addNewValue(propID)">+</cdx-button>
              </template>
              <span :style="valueTagStyle" v-for="(statement, idx) in statementsMap[propID]" :key="idx"  v-html="parseValue(statement)"></span>
            </cdx-field>
            <br>
            <cdx-accordion style="background: white; border: 1px solid #ccc;" v-if="otherPropertiesMap['external'].length > 0">
              <template #title>{{mw.msg('external-ids-title')}}</template>
              <cdx-field style="width: max-content;" v-for="propID in otherPropertiesMap['external']">
                <template #label>
                  {{properties[propID].label}}
                  <cdx-button @click="addNewValue(propID)">+</cdx-button>
                </template>
                <span :style="valueTagStyle" v-for="(statement, idx) in statementsMap[propID]" :key="idx">
                  {{parseValue(statement)}}
                </span>
              </cdx-field>
            </cdx-accordion>
          </cdx-accordion>
          <br>
          <cdx-button action="progressive" weight="primary" v-if="!progress" @click="submitChanges">
            Submit changes
          </cdx-button>
        </div>
		  `,
        mounted() {
          $("title").prepend(mw.msg("menu-title") + ": ");
          $(".wikibase-title").prepend(mw.msg("menu-title") + ":");

          const itemID = mw.config.get("wbEntityId");
          var api = new mw.Api();
          var requestParams = {
            action: "wbgetentities",
            format: "json",
            ids: itemID,
          };

          var result = api.get(requestParams);
          const that = this;
          result.done(async function (res) {
            var entity = res.entities[itemID];
            instancesOf = getInstanceOfProperties(entity);
            await getParentClasses(instancesOf);
            that.classIDs = classIDList;
            await retrieveClassProperties(
              api,
              requestParams,
              classIDList,
              entity
            );
            that.classLabels = allClassLabels;
            await fetchPropertyLabels(api, allProperties, classIDList);
            that.properties = {};
            allPropertyLabels.forEach(function (obj) {
              that.properties[obj.id] = obj;
            });
            var newClassPropertiesMap = {};
            var newOtherPropertiesMap = {
              general: [],
              external: [],
            };
            const allGenerals = allPropertyLabels
              .filter(function (obj) {
                return obj.datatype !== "external-id";
              })
              .map(function (obj) {
                return obj.id;
              });
            const allExternals = allPropertyLabels
              .filter(function (obj) {
                return obj.datatype === "external-id";
              })
              .map(function (obj) {
                return obj.id;
              });
            classIDList.forEach(function (classID) {
              if (propertiesForClasses[classID]) {
                newClassPropertiesMap[classID] = {};
                newClassPropertiesMap[classID]["general"] =
                  propertiesForClasses[classID].filter(function (propID) {
                    return allGenerals.includes(propID);
                  });
                newClassPropertiesMap[classID]["external"] =
                  propertiesForClasses[classID].filter(function (propID) {
                    return allExternals.includes(propID);
                  });
              }
            });
            var existingGeneralPropertyIDs = [];
            var existingExternalPropertyIDs = [];
            Object.keys(newClassPropertiesMap).forEach(function (classID) {
              existingGeneralPropertyIDs = existingGeneralPropertyIDs.concat(
                newClassPropertiesMap[classID]["general"]
              );
              existingExternalPropertyIDs = existingExternalPropertyIDs.concat(
                newClassPropertiesMap[classID]["external"]
              );
            });
            allPropertyLabels.forEach(function (prop) {
              if (prop.datatype !== "external-id") {
                if (!existingGeneralPropertyIDs.includes(prop.id)) {
                  newOtherPropertiesMap["general"].push(prop.id);
                }
              } else {
                if (!existingExternalPropertyIDs.includes(prop.id)) {
                  newOtherPropertiesMap["external"].push(prop.id);
                }
              }
            });
            var allQualifiers = new Set();
            var allEntityIDs = new Set();
            Object.keys(statementsMap).forEach(function (propID) {
              var qualifiers = new Set();
              statementsMap[propID].forEach(function (statement) {
                if (statement.qualifiers) {
                  Object.keys(statement.qualifiers).forEach(function (
                    qualifierID
                  ) {
                    qualifiers.add(qualifierID);
                    allQualifiers.add(qualifierID);
                  });
                }
                if (
                  statement.mainsnak.datatype === "wikibase-item" &&
                  statement.mainsnak.snaktype !== "novalue" &&
                  statement.mainsnak.snaktype !== "somevalue"
                ) {
                  allEntityIDs.add(statement.mainsnak.datavalue.value.id);
                }
              });
            });
            allQualifiers = Array.from(allQualifiers);
            allEntityIDs = Array.from(allEntityIDs);
            const allIDs = allQualifiers.concat(allEntityIDs);
            await fetchEntityAndQualifierLabels(api, allIDs);
            that.otherPropertiesMap = newOtherPropertiesMap;
            that.classPropertiesMap = newClassPropertiesMap;
            that.statementsMap = statementsMap;
            that.newStatementsMap = newStatementsMap;
            that.progress = false;
          });
        },
        methods: {
          getWikibaseURL: function (id) {
            var wbrepo = mw.config.get("wbRepo");
            return wbrepo.url + wbrepo.articlePath.replace("$1", id);
          },
          parseDateTime: function (timeString) {
            const cleanDateTime = timeString.slice(1, -1);
            const parsedDate = new Date(cleanDateTime);
            const localDateTime = new Date(
              parsedDate.getTime() - parsedDate.getTimezoneOffset() * 60000
            );
            const formattedDateTime = localDateTime.toISOString().slice(0, 19);
            return formattedDateTime;
          },
          addNewValue: function (propID) {
            const propDataType = propertyDatatypeMap[propID];
            var statement = {
              mainsnak: {
                snaktype: "value",
                property: propID,
                datavalue: {},
                datatype: propDataType,
              },
              id: "",
            };
            if (propDataType === "wikibase-item") {
              statement.mainsnak.datavalue = {
                value: {
                  "entity-type": "item",
                  "numeric-id": null,
                  id: "",
                },
              };
            } else if (
              propDataType === "string" ||
              propDataType === "commonsMedia" ||
              propDataType === "external-id"
            ) {
              statement.mainsnak.datavalue = {
                value: "",
              };
            } else if (propDataType === "quantity") {
              statement.mainsnak.datavalue = {
                value: {
                  amount: "",
                },
              };
            } else if (propDataType === "time") {
              statement.mainsnak.datavalue = {
                value: {
                  time: "",
                },
              };
            }
            if (newStatementsMap[propID]) {
              this.newStatementsMap[propID].unshift(statement);
            } else {
              this.newStatementsMap[propID] = [];
              this.newStatementsMap[propID].push(statement);
            }
          },
          comboboxOnChange: function (value, propID) {
            this.autocompleteItems = [];
            this.$forceUpdate();
            var api = new mw.Api();
            const that = this;
            const lang = mw.config.get("wgUserLanguage");
            var sparqlQuery =
              "\nSELECT DISTINCT (STRAFTER(STR(?item), 'http://www.wikidata.org/entity/') AS ?itemID) ?itemLabel ?itemDescription WHERE {\n  ?item wdt:" +
              propID +
              " [].\n" +
              "?item rdfs:label ?itemLabel.\n" +
              "?item schema:description ?itemDescription.\n";
            var instancesOfList = instancesOf.map(function (classID) {
              return "{\n ?item wdt:P31/wdt:P279* wd:" + classID + ".\n}\n";
            });
            sparqlQuery += instancesOfList.join(" UNION ");
            sparqlQuery +=
              'FILTER(LANG(?itemLabel) = "' +
              lang +
              '").\n' +
              'FILTER(LANG(?itemDescription) = "' +
              lang +
              '").\n' +
              'FILTER(STRSTARTS(LCASE(?itemLabel), "' +
              value.toLowerCase() +
              '"))\n' +
              "}LIMIT 20\n";
            var url = "https://query.wikidata.org/sparql";
            var params =
              "action=query&format=json&list=sparqlquery&utf8=1&query=" +
              encodeURIComponent(sparqlQuery);

            var xhr = new XMLHttpRequest();
            xhr.open("GET", url + "?" + params, true);
            xhr.onreadystatechange = async function () {
              if (xhr.readyState === 4) {
                if (xhr.status === 200) {
                  var data = JSON.parse(xhr.responseText);
                  var items = data.results.bindings;
                  var options = items.map(function (entry) {
                    return {
                      id: entry.itemID.value,
                      label: entry.itemLabel.value,
                      description: entry.itemDescription
                        ? entry.itemDescription.value
                        : "",
                      url: entry.itemURL ? entry.itemURL.value : "",
                      match: {
                        type: entry.matchType ? entry.matchType.value : "",
                        text: entry.matchText ? entry.matchText.value : "",
                        language: entry.matchLanguage
                          ? entry.matchLanguage.value
                          : "",
                      },
                      display: {
                        label: {
                          language: entry.itemLabelLanguage
                            ? entry.itemLabelLanguage.value
                            : "",
                        },
                        description: {
                          language: entry.itemDescriptionLanguage
                            ? entry.itemDescriptionLanguage.value
                            : "",
                        },
                      },
                      thumbnail: entry.thumbnail
                        ? {
                            url: entry.thumbnail.value,
                            width: entry.thumbnailWidth
                              ? entry.thumbnailWidth.value
                              : null,
                            height: entry.thumbnailHeight
                              ? entry.thumbnailHeight.value
                              : null,
                          }
                        : undefined,
                    };
                  });
                  if (options.length < 20) {
                    var api = new mw.Api();
                    const lang = mw.config.get("wgUserLanguage");
                    var requestParams = {
                      action: "wbsearchentities",
                      format: "json",
                      search: value,
                      language: lang,
                      type: "item",
                      limit: 20,
                    };
                    var data = await api.get($.extend({}, requestParams, {}));
                    options = options.concat(data.search);
                  }
                  that.autocompleteItems =
                    options && options.length > 0
                      ? adaptApiResponse(options)
                      : [];
                  that.$forceUpdate();
                }
              }
            };
            xhr.send();
          },
          comboboxOnSelect: function (value) {
            let selectedValue = value;
          },
        },
        resetOptions: function (event) {
          this.autocompleteItems = [];
          this.$forceUpdate();
        },
      })
        .component("cdx-button", Codex.CdxButton)
        .component("cdx-typeahead-search", Codex.CdxTypeaheadSearch)
        .component("cdx-field", Codex.CdxField)
        .component("cdx-progress-bar", Codex.CdxProgressBar)
        .component("cdx-text-input", Codex.CdxTextInput)
        .component("cdx-accordion", Codex.CdxAccordion)
        .mount("#mw-content-text");
    }
  }
});