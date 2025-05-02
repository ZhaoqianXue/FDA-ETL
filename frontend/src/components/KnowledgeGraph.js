/* global d3 saveSvgAsPng */
import React, { useEffect, useRef, useState } from 'react';
import './KnowledgeGraph.css';

const KnowledgeGraph = ({ events, loading, filters, topPercent }) => {
  const svgRef = useRef(null);
  const tooltipRef = useRef(null);
  const containerRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  // Process events data into graph format
  useEffect(() => {
    if (!events || events.length === 0) {
      setGraphData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    
    // Create nodes and links data structures
    const nodes = [];
    const nodeMap = new Map();
    const links = [];
    const medications = new Set();
    const sideEffectCounter = {};
    
    // Add medication nodes first
    const medicationsData = getMedicationsFromEvents(events);
    medicationsData.forEach(med => {
      medications.add(med.name);
      const medNode = {
        id: med.name,
        type: 'medication',
        count: med.count
      };
      nodeMap.set(med.name, medNode);
      nodes.push(medNode);
    });
    
    // Now process each event to create side effect nodes and links
    events.forEach(event => {
      const medication = event.drug_medicinalproduct;
      const sideEffect = event.reaction_reactionmeddrapt;
      
      // Skip if medication or side effect is missing
      if (!medication || !sideEffect) return;
      
      // Format medication name with proper capitalization
      const medicationName = formatDrugName(medication);
      
      // Count side effects
      sideEffectCounter[sideEffect] = (sideEffectCounter[sideEffect] || 0) + 1;
      
      // Create side effect node if it doesn't exist
      if (!nodeMap.has(sideEffect)) {
        const effectNode = {
          id: sideEffect,
          type: 'sideEffect',
          count: 0,
          severities: {},
          genders: {},
          ages: [],
          weights: [],
          routes: {},
          dosages: {}
        };
        nodeMap.set(sideEffect, effectNode);
        nodes.push(effectNode);
      }
      
      // Update statistics
      const sideEffectNode = nodeMap.get(sideEffect);
      sideEffectNode.count += 1;
      
      // Record severity
      const severity = event.top_serious === 1 ? 'Serious' : 'Non-serious';
      sideEffectNode.severities[severity] = (sideEffectNode.severities[severity] || 0) + 1;
      
      // Record gender
      const gender = event.patient_patientsex === 1 ? 'Male' : 
                     event.patient_patientsex === 2 ? 'Female' : 'Unknown';
      sideEffectNode.genders[gender] = (sideEffectNode.genders[gender] || 0) + 1;
      
      // Record age
      if (event.patient_patientonsetage != null) {
        sideEffectNode.ages.push(parseInt(event.patient_patientonsetage, 10));
      }
      
      // Record weight
      if (event.patient_patientweight != null) {
        sideEffectNode.weights.push(parseFloat(event.patient_patientweight));
      }
      
      // Record route
      if (event.drug_openfda_route) {
        const route = formatRoute(event.drug_openfda_route);
        sideEffectNode.routes[route] = (sideEffectNode.routes[route] || 0) + 1;
      }
      
      // Record dosage
      if (event.drug_drugstructuredosagenumb) {
        const dosageUnitMap = {
          '001': 'mg', '002': 'g', '003': 'ml', '004': 'units', '005': 'ug', 
          '006': 'ng', '007': 'meq', '008': 'mmol', '009': '%', '010': 'IU'
        };
        
        let dosage = event.drug_drugstructuredosagenumb;
        if (event.drug_drugstructuredosageunit && dosageUnitMap[event.drug_drugstructuredosageunit]) {
          dosage += ' ' + dosageUnitMap[event.drug_drugstructuredosageunit];
        }
        
        sideEffectNode.dosages[dosage] = (sideEffectNode.dosages[dosage] || 0) + 1;
      }
      
      // Add link between medication and side effect
      const existingLinkIndex = links.findIndex(link => 
        link.source === medicationName && link.target === sideEffect);
      
      // Add example data for this relationship
      const example = {
        severity: severity,
        gender: gender,
        age: event.patient_patientonsetage != null ? parseInt(event.patient_patientonsetage, 10) : null,
        weight: event.patient_patientweight,
        route: event.drug_openfda_route ? formatRoute(event.drug_openfda_route) : null,
        dosage: event.drug_drugstructuredosagenumb
      };
      
      if (existingLinkIndex >= 0) {
        links[existingLinkIndex].weight += 1;
        links[existingLinkIndex].examples.push(example);
      } else {
        links.push({
          source: medicationName,
          target: sideEffect,
          weight: 1,
          examples: [example]
        });
      }
    });
    
    // Calculate averages for each side effect node
    nodes.forEach(node => {
      if (node.type === 'sideEffect') {
        // Calculate average age
        if (node.ages.length > 0) {
          node.avgAge = node.ages.reduce((sum, age) => sum + age, 0) / node.ages.length;
        }
        
        // Calculate average weight
        if (node.weights.length > 0) {
          node.avgWeight = node.weights.reduce((sum, weight) => sum + weight, 0) / node.weights.length;
        }
      }
    });
    
    // Filter to top X% side effects
    const sideEffectNodes = nodes.filter(n => n.type === 'sideEffect');
    const totalEffects = sideEffectNodes.length;
    const numToShow = Math.max(1, Math.round(totalEffects * topPercent / 100));
    // Sort by count descending, take top numToShow
    const topSideEffects = sideEffectNodes
      .sort((a, b) => b.count - a.count)
      .slice(0, numToShow)
      .map(n => n.id);
    // Filter nodes and links
    const filteredNodes = nodes.filter(n => n.type !== 'sideEffect' || topSideEffects.includes(n.id));
    const filteredLinks = links.filter(l => topSideEffects.includes(l.target));
    setGraphData({ nodes: filteredNodes, links: filteredLinks, medications: Array.from(medications) });
    setIsLoading(false);
  }, [events, topPercent]);

  // Create and update the graph visualization
  useEffect(() => {
    if (!graphData || !svgRef.current) return;
    
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;
    
    // Create force simulation
    const simulation = d3.forceSimulation(graphData.nodes)
      .force("link", d3.forceLink(graphData.links)
        .id(d => d.id)
        .distance(d => 100 + d.weight * 2))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(d => getNodeRadius(d) + 5));
    
    // Create a root SVG group for zooming
    const root = svg.append("g");
    
    // Initialize D3 zoom behavior
    const zoomBehavior = d3.zoom()
      .scaleExtent([0.1, 4])
      .on("zoom", (event) => {
        root.attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      });
    
    // Apply zoom behavior to SVG
    svg.call(zoomBehavior);
    
    // Create links
    const link = root.append("g")
      .selectAll("line")
      .data(graphData.links)
      .enter()
      .append("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", d => Math.sqrt(d.weight) * 0.8)
      .on("mouseover", function(event, d) {
        d3.select(this)
          .attr("stroke", "#ff6600")
          .attr("stroke-width", Math.sqrt(d.weight) * 1.5);
        
        showLinkTooltip(event, d);
      })
      .on("mouseout", function() {
        d3.select(this)
          .attr("stroke", "#999")
          .attr("stroke-width", d => Math.sqrt(d.weight) * 0.8);
        
        hideTooltip();
      });
    
    // Create nodes
    const node = root.append("g")
      .selectAll("circle")
      .data(graphData.nodes)
      .enter()
      .append("circle")
      .attr("r", getNodeRadius)
      .attr("fill", getNodeColor)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.5)
      .attr("cursor", "pointer")
      .call(d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended))
      .on("mouseover", function(event, d) {
        showNodeTooltip(event, d);
      })
      .on("mouseout", hideTooltip)
      .on("click", function(event, d) {
        // Toggle node lock state
        if (d.fx !== null && d.fy !== null) {
          d.fx = null;
          d.fy = null;
          d3.select(this).classed("locked-node", false);
        } else {
          d.fx = d.x;
          d.fy = d.y;
          d3.select(this).classed("locked-node", true);
        }
      });
    
    // Add node labels
    const label = root.append("g")
      .selectAll("text")
      .data(graphData.nodes)
      .enter()
      .append("text")
      .attr("dx", d => getNodeRadius(d) + 5)
      .attr("dy", ".35em")
      .text(d => d.id)
      .style("font-size", d => d.type === 'medication' ? '18px' : '14px')
      .style("font-weight", d => d.type === 'medication' ? 'bold' : 'normal')
      .style("pointer-events", "none");
    
    // Update force simulation
    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
      
      node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
      
      label
        .attr("x", d => d.x)
        .attr("y", d => d.y);
    });
    
    // Drag functions
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      // Node positions remain locked until user explicitly unlocks them
    }
  }, [graphData]);
  
  // Helper functions
  
  // Get medications from events
  const getMedicationsFromEvents = (events) => {
    const medicationCounts = {};
    
    events.forEach(event => {
      if (!event.drug_medicinalproduct) return;
      
      const medication = formatDrugName(event.drug_medicinalproduct);
      medicationCounts[medication] = (medicationCounts[medication] || 0) + 1;
    });
    
    return Object.entries(medicationCounts).map(([name, count]) => ({ name, count }));
  };
  
  // Format drug name with proper capitalization
  const formatDrugName = (name) => {
    if (!name) return '';
    const n = name.toLowerCase();
    if (n === 'semaglutide') return 'Semaglutide';
    if (n === 'tirzepatide') return 'Tirzepatide';
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
  };
  
  // Format route with proper capitalization
  const formatRoute = (route) => {
    if (!route) return 'Unknown';
    return route.charAt(0).toUpperCase() + route.slice(1).toLowerCase();
  };
  
  // Calculate node radius based on type and count
  const getNodeRadius = (node) => {
    if (node.type === 'medication') {
      // Reduce Semaglutide and Tirzepatide size by 50%
      if (node.id === 'Semaglutide' || node.id === 'Tirzepatide') {
        return (20 + Math.sqrt(node.count)) * 0.5;
      }
      return 20 + Math.sqrt(node.count);
    } else {
      return 10 + Math.sqrt(node.count);
    }
  };
  
  // Determine node color based on type
  const getNodeColor = (node) => {
    if (node.type === 'medication') {
      // Different colors for different medications
      if (node.id === 'Semaglutide') return '#D36F66';
      if (node.id === 'Tirzepatide') return '#6D7EA2';
      return '#EFC29E';
    } else {
      // Side effect node color
      return '#B89EC8';
    }
  };
  
  // Show tooltip for a node
  const showNodeTooltip = (event, d) => {
    const tooltip = tooltipRef.current;
    
    let tooltipContent = '';
    
    if (d.type === 'medication') {
      tooltipContent = `
        <div class="tooltip-title">${d.id}</div>
        <div class="tooltip-content">
          Mentions: ${d.count}
        </div>
      `;
    } else {
      // Calculate severity percentage
      const totalSeverity = Object.values(d.severities).reduce((sum, count) => sum + count, 0);
      const severityPercentages = Object.entries(d.severities)
        .map(([severity, count]) => `${severity}: ${Math.round(count / totalSeverity * 100)}%`)
        .join(', ');
      
      // Calculate gender percentage
      const totalGender = Object.values(d.genders).reduce((sum, count) => sum + count, 0);
      const genderPercentages = Object.entries(d.genders)
        .map(([gender, count]) => `${gender}: ${Math.round(count / totalGender * 100)}%`)
        .join(', ');
      
      // Top routes
      const topRoutes = Object.entries(d.routes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([route, count]) => `${route}: ${count}`)
        .join(', ');
      
      // Top dosages
      const topDosages = Object.entries(d.dosages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([dosage, count]) => `${dosage}: ${count}`)
        .join(', ');
      
      tooltipContent = `
        <div class="tooltip-title">${d.id}</div>
        <div class="tooltip-content">
          <strong>Mentions:</strong> ${d.count}<br>
          <strong>Severity:</strong> ${severityPercentages}<br>
          <strong>Gender:</strong> ${genderPercentages}<br>
          <strong>Avg Age:</strong> ${d.avgAge ? Math.round(d.avgAge) : 'Unknown'}<br>
          <strong>Avg Weight:</strong> ${d.avgWeight ? Math.round(d.avgWeight * 10) / 10 : 'Unknown'} kg<br>
          ${topRoutes ? `<strong>Top Routes:</strong> ${topRoutes}<br>` : ''}
          ${topDosages ? `<strong>Top Dosages:</strong> ${topDosages}` : ''}
        </div>
      `;
    }
    
    tooltip.innerHTML = tooltipContent;
    tooltip.style.display = 'block';
    
    // Position tooltip
    positionTooltip(event);
  };
  
  // Show tooltip for a link
  const showLinkTooltip = (event, d) => {
    const tooltip = tooltipRef.current;
    
    const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
    const targetId = typeof d.target === 'object' ? d.target.id : d.target;
    
    let tooltipContent = `
      <div class="tooltip-title">Relationship Details</div>
      <div class="tooltip-content">
        <strong>${sourceId} → ${targetId}</strong><br>
        Co-occurrences: ${d.weight}<br>
    `;
    
    // Check if we have examples
    if (d.examples && d.examples.length > 0) {
      // Calculate completeness score for each example
      const scoredExamples = d.examples.map(example => {
        let completeness = 0;
        if (example.severity) completeness++;
        if (example.gender && example.gender !== 'Unknown') completeness++;
        if (example.age) completeness++;
        if (example.weight) completeness++;
        if (example.route) completeness++;
        if (example.dosage) completeness++;
        return { example, completeness };
      });
      
      // Sort examples by completeness score (most complete first)
      scoredExamples.sort((a, b) => b.completeness - a.completeness);
      
      // Show the most complete example
      if (scoredExamples.length > 0) {
        tooltipContent += `<br><strong>Example:</strong><br>`;
        const example = scoredExamples[0].example;
        
        if (example.severity) {
          tooltipContent += `- Severity: ${example.severity}<br>`;
        }
        
        if (example.gender && example.gender !== 'Unknown') {
          tooltipContent += `- Gender: ${example.gender}<br>`;
        }
        
        if (example.age) {
          tooltipContent += `- Age: ${example.age}<br>`;
        }
        
        if (example.weight) {
          tooltipContent += `- Weight: ${example.weight} kg<br>`;
        }
        
        if (example.route) {
          tooltipContent += `- Route: ${example.route}<br>`;
        }
        
        if (example.dosage) {
          tooltipContent += `- Dosage: ${example.dosage}<br>`;
        }
      }
    }
    
    tooltipContent += `</div>`;
    
    tooltip.innerHTML = tooltipContent;
    tooltip.style.display = 'block';
    
    // Position tooltip
    positionTooltip(event);
  };
  
  // Position tooltip based on mouse position
  const positionTooltip = (event) => {
    const tooltip = tooltipRef.current;
    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    
    // Get mouse position relative to container
    const mouseX = event.clientX - containerRect.left;
    const mouseY = event.clientY - containerRect.top;
    
    // Get tooltip dimensions
    const tooltipWidth = tooltip.offsetWidth;
    const tooltipHeight = tooltip.offsetHeight;
    
    // Calculate tooltip position
    let tooltipX, tooltipY;
    
    // Position horizontally
    if (mouseX + tooltipWidth + 20 > containerRect.width) {
      tooltipX = mouseX - tooltipWidth - 10;
    } else {
      tooltipX = mouseX + 20;
    }
    
    // Position vertically
    if (mouseY + tooltipHeight + 20 > containerRect.height) {
      tooltipY = mouseY - tooltipHeight - 10;
    } else {
      tooltipY = mouseY + 20;
    }
    
    // Ensure tooltip stays within container
    tooltipX = Math.max(10, Math.min(containerRect.width - tooltipWidth - 10, tooltipX));
    tooltipY = Math.max(10, Math.min(containerRect.height - tooltipHeight - 10, tooltipY));
    
    // Set tooltip position
    tooltip.style.left = `${tooltipX}px`;
    tooltip.style.top = `${tooltipY}px`;
  };
  
  // Hide tooltip
  const hideTooltip = () => {
    const tooltip = tooltipRef.current;
    tooltip.style.display = 'none';
  };
  
  // Handle zoom controls
  const handleZoomIn = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom().on("zoom", (event) => {
        d3.select(svgRef.current).select("g").attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      }).scaleBy, 1.3
    );
  };
  
  const handleZoomOut = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom().on("zoom", (event) => {
        d3.select(svgRef.current).select("g").attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      }).scaleBy, 0.7
    );
  };
  
  const handleZoomReset = () => {
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(
      d3.zoom().on("zoom", (event) => {
        d3.select(svgRef.current).select("g").attr("transform", event.transform);
        setZoomLevel(event.transform.k);
      }).transform, d3.zoomIdentity
    );
  };
  
  // Save as image
  const handleSaveImage = () => {
    const svgElement = svgRef.current;
    saveSvgAsPng(svgElement, 'drug_adverse_events_graph.png', {
      scale: 2,
      backgroundColor: 'white',
      encoderOptions: 1
    });
  };

  return (
    <div className="graph-container" ref={containerRef}>
      <svg ref={svgRef} width="100%" height="500px"></svg>
      {/* Tooltip for node and edge details */}
      <div className="graph-tooltip" ref={tooltipRef}></div>
      {/* Legend */}
      <div className="graph-legend">
        <div className="legend-title">Legend</div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#D36F66' }}></div>
          <span>Semaglutide</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#6D7EA2' }}></div>
          <span>Tirzepatide</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: '#B89EC8' }}></div>
          <span>Adverse Events</span>
        </div>
      </div>
      {/* Zoom controls */}
      <div className="zoom-controls">
        <button className="zoom-btn" onClick={handleZoomIn}>+</button>
        <div className="zoom-level">{Math.round(zoomLevel * 100)}%</div>
        <button className="zoom-btn" onClick={handleZoomOut}>-</button>
        <button className="zoom-btn" onClick={handleZoomReset}>↺</button>
      </div>
      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner"></div>
          <p>Building knowledge graph...</p>
        </div>
      )}
      {/* No data message */}
      {!isLoading && (!graphData || graphData.nodes.length === 0) && (
        <div className="no-data-message">
          <p>No data available for the knowledge graph. Try adjusting your filters.</p>
        </div>
      )}
    </div>
  );
};

export default KnowledgeGraph; 