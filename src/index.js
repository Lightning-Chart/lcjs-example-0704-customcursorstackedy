/*
 * LightningChartJS example that showcases custom cursor implementation with stacked Y charts.
 */
// Import LightningChartJS
const lcjs = require('@arction/lcjs')

// Extract required parts from LightningChartJS.
const {
    lightningChart,
    emptyFill,
    AxisTickStrategies,
    AutoCursorModes,
    UILayoutBuilders,
    UIElementBuilders,
    UIOrigins,
    synchronizeAxisIntervals,
    Themes,
} = lcjs

// Import data-generator from 'xydata'-library.
const { createProgressiveTraceGenerator } = require('@arction/xydata')

const channels = ['Ch 1', 'Ch 2', 'Ch 3']
const channelCount = channels.length

// Create Dashboard.
// NOTE: Using `Dashboard` is no longer recommended for new applications. Find latest recommendations here: https://lightningchart.com/js-charts/docs/basic-topics/grouping-charts/
const dashboard = lightningChart().Dashboard({
    theme: Themes[new URLSearchParams(window.location.search).get('theme') || 'darkGold'] || undefined,
    numberOfRows: channelCount,
    numberOfColumns: 1,
})

// Map XY-charts to Dashboard for each channel.
const charts = channels.map((channelName, i) => {
    const chart = dashboard.createChartXY({
        columnIndex: 0,
        rowIndex: i,
        columnSpan: 1,
        rowSpan: 1,
    })

    // Disable default auto cursor.
    chart.setAutoCursorMode(AutoCursorModes.disabled)

    if (i === 0) {
        chart.setTitle('Stacked Y Dashboard with Custom Cursor')
    } else {
        chart.setTitleFillStyle(emptyFill)
    }

    // Only display X ticks for bottom chart.
    if (i !== channelCount - 1) {
        chart.getDefaultAxisX().setTickStrategy(AxisTickStrategies.Empty)
    }

    // Align Y axes of stacked charts.
    chart.getDefaultAxisY().setThickness(50)

    return chart
})

// The bottom X Axis, which shows ticks for all stacked charts.
const axisX = charts[charts.length - 1].getDefaultAxisX()

// Add progressive line series to each chart.
const seriesList = charts.map((chart, i) =>
    chart.addLineSeries({
        dataPattern: {
            // pattern: 'ProgressiveX' => Each consecutive data point has increased X coordinate.
            pattern: 'ProgressiveX',
        },
    }),
)

// Code for synchronizing all X Axis intervals in stacked XY charts.
const syncedAxes = charts.map((chart) => chart.getDefaultAxisX())
synchronizeAxisIntervals(...syncedAxes)

// Create UI elements for custom cursor.
const resultTable = dashboard
    .addUIElement(UILayoutBuilders.Column, dashboard.coordsRelative)
    .setMouseInteractions(false)
    .setOrigin(UIOrigins.LeftBottom)
    .setMargin(5)
    .setBackground((background) =>
        background
            // Style same as Theme result table.
            .setFillStyle(dashboard.getTheme().cursorResultTableFillStyle)
            .setStrokeStyle(dashboard.getTheme().cursorResultTableStrokeStyle),
    )

const resultTableTextBuilder = UIElementBuilders.TextBox
    // Style same as Theme result table text.
    .addStyler((textBox) => textBox.setTextFillStyle(dashboard.getTheme().cursorResultTableTextFillStyle))

const rowX = resultTable.addElement(UILayoutBuilders.Row).addElement(resultTableTextBuilder)

const rowsY = seriesList.map((el, i) => {
    return resultTable.addElement(UILayoutBuilders.Row).addElement(resultTableTextBuilder)
})

const tickX = charts[channelCount - 1]
    .getDefaultAxisX()
    .addCustomTick(UIElementBuilders.PointableTextBox)
    .setAllocatesAxisSpace(false)
    .setGridStrokeStyle(dashboard.getTheme().cursorGridStrokeStyleX)

const ticksX = []
charts.forEach((chart, i) => {
    if (i !== channelCount - 1) {
        ticksX.push(
            chart
                .getDefaultAxisX()
                .addConstantLine()
                .setValue(0)
                .setMouseInteractions(false)
                // Style according to Theme cursor grid stroke.
                .setStrokeStyle(dashboard.getTheme().cursorGridStrokeStyleX),
        )
    }
})

const ticksY = seriesList.map((el, i) => {
    return charts[i].getDefaultAxisY().addCustomTick(UIElementBuilders.PointableTextBox).setAllocatesAxisSpace(false)
})

const setCustomCursorVisible = (visible) => {
    if (!visible) {
        resultTable.setVisible(false)
        tickX.setVisible(false)
        ticksY.forEach((el) => el.setVisible(false))
        ticksX.forEach((el) => el.setVisible(false))
    } else {
        resultTable.setVisible(true)
        tickX.setVisible(true)
        ticksY.forEach((el) => el.setVisible(true))
        ticksX.forEach((el) => el.setVisible(true))
    }
}
// Hide custom cursor components initially.
setCustomCursorVisible(false)

const showCursorAt = (clientCoordinate) => {
    // Find the nearest data point to the mouse.
    const nearestDataPoints = seriesList.map((el) => el.solveNearestFromScreen(clientCoordinate))

    // Abort operation if any of solved data points is `undefined`.
    if (nearestDataPoints.includes(undefined)) {
        setCustomCursorVisible(false)
        return
    }

    // Set custom cursor location.
    resultTable.setPosition(dashboard.translateCoordinate(clientCoordinate, dashboard.coordsRelative))

    // Format result table text.
    rowX.setText(`X: ${charts[0].getDefaultAxisX().formatValue(nearestDataPoints[0].location.x)}`)
    rowsY.forEach((rowY, i) => {
        rowY.setText(`Y${i}: ${charts[i].getDefaultAxisY().formatValue(nearestDataPoints[i].location.y)}`)
    })

    // Position custom ticks.
    tickX.setValue(nearestDataPoints[0].location.x)
    ticksX.forEach((tick, i) => {
        tick.setValue(tickX.getValue())
    })
    ticksY.forEach((tick, i) => {
        tick.setValue(nearestDataPoints[i].location.y)
    })

    // Display cursor.
    setCustomCursorVisible(true)
}

// Implement custom cursor logic with events.
const mouseMoveHandler = (_, event) => {
    showCursorAt(event)
}

charts.forEach((chart, i) => {
    chart.onSeriesBackgroundMouseMove(mouseMoveHandler)
    seriesList[i].onMouseMove(mouseMoveHandler)
    seriesList[i].onMouseLeave(() => {
        setCustomCursorVisible(false)
    })

    // hide custom cursor and ticks if mouse leaves chart area
    chart.onSeriesBackgroundMouseLeave((_, e) => {
        setCustomCursorVisible(false)
    })

    // hide custom cursor and ticks on Drag
    chart.onSeriesBackgroundMouseDragStart((_, e) => {
        setCustomCursorVisible(false)
    })
})

// Generate data and add to series
Promise.all(
    seriesList.map((series) =>
        createProgressiveTraceGenerator()
            .setNumberOfPoints(100 * 1000)
            .generate()
            .toPromise()
            .then((data) => {
                series.add(data)
            }),
    ),
).then(() => {
    charts.forEach((chart) => chart.forEachAxis((axis) => axis.fit(false)))
    requestAnimationFrame(() => {
        // Show custom cursor at start automatically.
        showCursorAt({ clientX: 500, clientY: 500 })
    })
})
