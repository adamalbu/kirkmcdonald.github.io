"use strict"

function displayValue(x, precision) {
    if (displayFormat == "rational") {
        return x.toMixed()
    } else {
        return x.toDecimal(precision)
    }
}

function displayRate(x) {
    x = x.mul(displayRateFactor)
    return displayValue(x, ratePrecision)
}

function displayCount(x) {
    if (countPrecision == 0) {
        return x.ceil().toString()
    }
    return displayValue(x, countPrecision)
}

function align(s, prec) {
    if (displayFormat == "rational") {
        return s
    }
    var idx = s.indexOf(".")
    if (idx == -1) {
        idx = s.length
    }
    var toAdd = prec - s.length + idx + 1
    while (toAdd > 0) {
        s += "\u00A0"
        toAdd--
    }
    return s
}

function alignRate(x) {
    return align(displayRate(x), ratePrecision)
}

function alignCount(x) {
    return align(displayCount(x), countPrecision)
}

function displaySteps(node, sortedTotals, totals) {
    var order = []
    var items = {}
    for (var i = 0; i < sortedTotals.length; i++) {
        var recipeName = sortedTotals[i]
        var recipeRate = totals.totals[recipeName]
        var recipe = solver.recipes[recipeName]
        for (var j = 0; j < recipe.products.length; j++) {
            var ing = recipe.products[j]
            if (!(ing.item.name in items)) {
                order.push(ing.item.name)
                items[ing.item.name] = zero
            }
            items[ing.item.name] = items[ing.item.name].add(recipeRate.mul(recipe.gives(ing.item, spec)))
        }
    }
    var headers = [
        new Header("items/" + rateName, 2),
        new Header("belts", 2)
    ]
    var header = document.createElement("tr")
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        th.textContent = headers[i].name
        th.colSpan = headers[i].colSpan
        if (i > 0) {
            th.classList.add("pad")
        }
        header.appendChild(th)
    }
    node.appendChild(header)
    for (var i = 0; i < order.length; i++) {
        var itemName = order[i]
        var item = solver.items[itemName]
        var rate = items[itemName]
        var row = document.createElement("tr")
        node.appendChild(row)
        var iconCell = document.createElement("td")
        iconCell.appendChild(getImage(itemName))
        row.appendChild(iconCell)
        var rateCell = document.createElement("td")
        rateCell.classList.add("right-align")
        var tt = document.createElement("tt")
        tt.textContent = alignRate(rate)
        rateCell.append(tt)
        row.appendChild(rateCell)

        if (item.phase == "solid") {
            var belts = rate.div(RationalFromFloats(800, 60))
            var beltCell = document.createElement("td")
            beltCell.classList.add("pad")
            beltCell.appendChild(getImage("transport-belt"))
            beltCell.appendChild(new Text(" \u00d7"))
            row.appendChild(beltCell)
            var beltRateCell = document.createElement("td")
            beltRateCell.classList.add("right-align")
            tt = document.createElement("tt")
            tt.textContent = alignCount(belts)
            beltRateCell.append(tt)
            row.appendChild(beltRateCell)
        }
    }
}

var sortOrder = "topo"

function pruneSpec(totals) {
    var drop = []
    for (var name in spec.spec) {
        if (!(name in totals.totals)) {
            drop.push(name)
        }
    }
    for (var i = 0; i < drop.length; i++) {
        delete spec.spec[drop[i]]
    }
    drop = []
    for (var name in spec.ignore) {
        if (!(name in totals.totals)) {
            drop.push(name)
        }
    }
    for (var i = 0; i < drop.length; i++) {
        delete spec.ignore[drop[i]]
    }
}

var globalTotals

// The main top-level calculation function. Called whenever the solution
// requires recalculation.
//
// This function obtains the set of item-rates to solve for from build_targets,
// the set of modules from spec, and obtains a solution from solver. The
// factory counts are then obtained from the solution using the spec.
function itemUpdate() {
    var rates = {}
    for (var i = 0; i < build_targets.length; i++) {
        var target = build_targets[i]
        var rate = target.getRate()
        rates[target.itemName] = rate
    }
    globalTotals = solver.solve(rates, spec.ignore, spec)
    display()
}

function Header(name, colSpan) {
    if (!colSpan) {
        colSpan = 1
    }
    return {"name": name, "colSpan": colSpan}
}

// Re-renders the current solution, without re-computing it.
function display() {
    // Update the display of the target rate text boxes, if needed.
    for (var i = 0; i < build_targets.length; i++) {
        build_targets[i].getRate()
    }
    var totals = globalTotals
    pruneSpec(totals)

    window.location.hash = "#" + formatSettings()

    if (currentTab == "graph_tab") {
        renderGraph(totals, spec.ignore)
    }
    var stepTab = document.getElementById("steps_tab")

    var oldSteps = document.getElementById("steps")
    var newSteps = document.createElement("table")
    newSteps.id = "steps"
    stepTab.replaceChild(newSteps, oldSteps)

    var totalTab = document.getElementById("totals_tab")

    var oldTotals = document.getElementById("totals")
    var newTotals = document.createElement("table")
    newTotals.id = "totals"
    var max_modules = 4
    var headers = [
        Header("recipe craft/" + rateName, 2),
        Header("factories", 2),
        Header("modules", max_modules + 1),
        Header("beacons", 2),
        Header("")
    ]
    var header = document.createElement("tr")
    for (var i = 0; i < headers.length; i++) {
        var th = document.createElement("th")
        th.textContent = headers[i].name
        th.colSpan = headers[i].colSpan
        if (i > 0) {
            th.classList.add("pad")
        }
        header.appendChild(th)
    }
    newTotals.appendChild(header)
    totalTab.replaceChild(newTotals, oldTotals)
    
    var downArrowShown = false
    var sorted_totals = sorted(totals.totals)
    if (sortOrder == "topo") {
        sorted_totals = totals.topo
    } else {
        sorted_totals = sorted(totals.totals)
    }
    displaySteps(newSteps, sorted_totals, totals)
    for (var i = 0; i < sorted_totals.length; i++) {
        var recipeName = sorted_totals[i]
        var recipe = solver.recipes[recipeName]
        var rate = totals.get(recipeName)
        var row = document.createElement("tr")
        row.classList.add("recipe-row")
        if (i % 2 == 1) {
            row.classList.add("odd")
        }
        if (spec.ignore[recipeName]) {
            row.classList.add("ignore")
        }

        var nameCell = document.createElement("td")
        nameCell.className = "right-align"
        var im = getImage(recipeName)
        if (spec.ignore[recipeName]) {
            im.title += " (click to unignore)"
        } else {
            im.title += " (click to ignore)"
        }
        im.classList.add("display")
        im.classList.add("recipe-icon")
        im.addEventListener("click", new IgnoreHandler(recipeName))
        nameCell.appendChild(im)
        row.appendChild(nameCell)

        var rateCell = document.createElement("td")
        rateCell.classList.add("right-align")
        var tt = document.createElement("tt")
        tt.textContent = alignRate(rate)
        rateCell.appendChild(tt)
        row.appendChild(rateCell)

        var factoryCount = spec.getCount(recipe, rate)
        if (!factoryCount.isZero()) {
            var factory = spec.getFactory(recipe)

            var factoryCell = document.createElement("td")
            factoryCell.classList.add("pad")
            var image = getImage(factory.name)
            image.classList.add("display")
            factoryCell.appendChild(image)
            factoryCell.appendChild(new Text(" \u00d7"))
            row.appendChild(factoryCell)

            var realCell = document.createElement("td")
            realCell.className = "right-align"
            var tt = document.createElement("tt")
            tt.textContent = alignCount(factoryCount)
            realCell.appendChild(tt)
            row.appendChild(realCell)

            for (var j = 0; j < factory.modules.length; j++) {
                var currentModule = factory.getModule(j)

                var modCell = document.createElement("td")
                if (j == 0) {
                    modCell.classList.add("pad")
                }
                row.appendChild(modCell)

                var moduleCount = 1
                for (var name in modules) {
                    if (modules[name].canUse(recipe)) {
                        moduleCount++
                    }
                }

                var dropdown = new Dropdown(
                    modCell,
                    "mod-" + recipeName + "-" + j,
                    new ModuleHandler(recipeName, factory, j)
                )

                var noModImage = getImage("slot-icon-module")
                noModImage.title = "no module"
                dropdown.add(noModImage, "no module", !currentModule)
                var category = ""

                for (var k = 0; k < sortedModules.length; k++) {
                    var name = sortedModules[k]
                    var module = modules[name]
                    if (!module.canUse(recipe)) {
                        continue
                    }
                    if (module.category != category || sortedModules.length <= 6) {
                        category = module.category
                        dropdown.addBreak()
                    }
                    dropdown.add(
                        getImage(name),
                        name,
                        currentModule && currentModule.name == name
                    )
                }
                if (j == 0) {
                    var buttonCell = document.createElement("td")
                    row.append(buttonCell)
                    var copyButton = document.createElement("button")
                    copyButton.classList.add("ui")
                    copyButton.textContent = "\u2192"
                    copyButton.title = "copy to rest of modules"
                    copyButton.addEventListener("click", new ModuleCopyHandler(recipeName, factory))
                    buttonCell.appendChild(copyButton)
                }
            }
            var dummiesNeeded = max_modules - factory.modules.length
            if (dummiesNeeded == max_modules) {
                dummiesNeeded++
            }
            for (var j = 0; j < dummiesNeeded; j++) {
                row.appendChild(document.createElement("td"))
            }

            if (factory.factory.canBeacon()) {
                var currentBeacon = factory.beaconModule
                var currentCount = factory.beaconCount

                var beaconCell = document.createElement("td")
                beaconCell.classList.add("pad")

                var moduleCount = 1
                for (var name in modules) {
                    if (modules[name].canBeacon()) {
                        moduleCount++
                    }
                }

                var beaconHandler = new BeaconHandler(recipeName)
                var beaconDropdown = new Dropdown(
                    beaconCell,
                    "mod-" + recipeName + "-beacon",
                    beaconHandler
                )

                var noModImage = getImage("slot-icon-module")
                noModImage.title = "no module"
                beaconDropdown.add(noModImage, "no module", !currentBeacon)
                var category = ""

                for (var j = 0; j < sortedModules.length; j++) {
                    var name = sortedModules[j]
                    var module = modules[name]
                    // No productivity modules in beacons.
                    if (!module.canBeacon()) {
                        continue
                    }
                    if (module.category != category || sortedModules.length <= 6) {
                        beaconDropdown.addBreak()
                        category = module.category
                    }
                    beaconDropdown.add(
                        getImage(name),
                        name,
                        currentBeacon && currentBeacon.name == name
                    )
                }
                row.appendChild(beaconCell)

                var countCell = document.createElement("td")
                var mult = document.createElement("span")
                mult.textContent = " \u00D7 "
                countCell.appendChild(mult)

                var beaconCountBox = document.createElement("input")
                beaconCountBox.addEventListener("change", new BeaconCountHandler(recipeName))
                beaconCountBox.type = "number"
                beaconCountBox.value = currentCount.toFloat()
                beaconCountBox.className = "beacon"
                beaconCountBox.title = "The number of broadcasted modules which will affect this factory."
                countCell.appendChild(beaconCountBox)
                row.appendChild(countCell)

                var downArrowCell = document.createElement("td")
                var downArrow = document.createElement("button")
                downArrow.classList.add("ui")
                if (!downArrowShown) {
                    downArrowShown = true
                    downArrow.textContent = "\u2193"
                } else {
                    downArrow.textContent = "\u2195"
                }
                downArrow.title = "copy this recipe's modules to all other recipes"
                downArrow.addEventListener("click", new CopyAllHandler(recipeName))
                downArrowCell.appendChild(downArrow)
                row.appendChild(downArrowCell)
            }
        }

        newTotals.appendChild(row)
    }
    downArrow.textContent = "\u2191"
}
