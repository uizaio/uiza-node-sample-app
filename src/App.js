import React, { Component } from 'react';
import ReactPlayer from 'react-player';
import './App.css';
import {
  BrowserRouter as Router,
  Switch,
  Route,
  Link,
  useParams
} from "react-router-dom";

// Define constants
const axios = require('axios').default;
const authorization_key = "uap-9fc1b6221f7b4f358fdd258bd0ed742f-8b56c154";
const url = "https://api.uiza.sh/v1/live_entities";
const default_headers = {
  "Content-Type": "application/json",
  "Authorization": authorization_key
}

// Define the video page that will open upon clicking on a video tile
function VideoPage() {
  // Playback URL is extracted as a paramter "videoid"
  let { videoid } = useParams();
  return (
    <div style={{ padding: "20px" }}>
      <ReactPlayer url={"https://" + videoid} playing={true} controls={true}></ReactPlayer>
    </div>)
}

class VideoTile extends Component {

  render() {
    return (
      <div style={{
        width: "240px", height: "200px", float: "left", margin: "10px", padding: "8px", display: "flex", flexDirection: "column",
        wordWrap: "break-word", fontSize: "16px", border: "2px solid white", backgroundColor: this.props._online ? 'MediumSeaGreen' : 'Tomato'
      }}>

        {/* The replace function below replaces the url protocol (HTTP | HTTPS) along with colon and backslashes at the beginning.
            Why? To allow using the video URL as a parameter that can later be read.
            For example: https://domain.com/playback_url.ext -> ./video/domain.com/playback_url.ext  */}
        <a href={"./video/" + this.props._playback_url.replace(/(^\w+:|^)\/\//, '')}>
          <span name='url'>URL: {this.props._url}</span><br /><br />
          <span name='key'>KEY: {this.props._key}</span><br /><br />
          <span name='playback_url'>PLAYBACK: {this.props._playback_url}</span>
        </a>
      </div>
    )
  }
}

class ViewerPage extends Component {
  /**
   * Summary.
   * This is the implmentation of viewer page as a react component.
   * The page will be shown after user clicks on "Viewer Page" link.
   */
  state = {
    last_loaded: "",
    streams: [],
    items: []
  }

  load_alive_streams = async () => {
    // Called to get streams from the API
    var options = {
      "method": "get",
      "url": url,
      "headers": {
        "Content-Type": "application/json",
        "Authorization": authorization_key
      }
    };
    var response = await axios(options);
    var data = response.data.data;
    var streams = [];
    data.forEach(element => {
      try {
        streams.push({
          // stream.online will be set as true if its online.
          online: element.broadcast === 'online' ? true : false,
          stream_url: element.ingest.url,
          stream_key: element.ingest.key,
          playback_url: element.playback.hls
        })
      } catch (err) { }
    });
    this.setState({
      streams: streams,

      // Last loaded will be time time we last loaded all the streams.
      last_loaded: new Date()
    });
    console.log(`Completed reading data: ${streams.length} streams are online now!`);
  }

  render() {
    try {

      if (typeof this.state.last_loaded === "string" || ((new Date() - this.state.last_loaded) / 1000) > 5) {
        var items = [];
        this.load_alive_streams().then((result) => {

          for (const [index, value] of this.state.streams.entries()) {
            items.push(<VideoTile key={index}
              _url={value.stream_url}
              _key={value.stream_key}
              _playback_url={value.playback_url}
              _online={value.online}></VideoTile>)
          }

          this.setState({ items: items });
          console.log('Loading complete');
        });
      }
    } catch (err) {
      this.setState({ last_loaded: new Date() });
    }

    return (
      <div className="App">
        <h1 style={{ padding: "8px" }}>  Uiza Online Videos </h1>
        <header className="App-header">
          <div name='tileContainer'>
            {this.state.items}
          </div></header>
      </div>
    )
  }
}

class BroadcastPage extends Component {

  //  Set the deafult state.
  state = {
    message: '',
    region_value: 'in-bangalore-1',
    broadcast_url: '',
    broadcast_key: ''
  };

  start_broadcast = async () => {
    
    // Set message to fetching and clear other fields.
    this.setState({ message: "Fetching" });
    this.setState({ broadcast_url: "" });
    this.setState({ broadcast_key: "" });

    // Options passed to API for creating API
    var broadcast_create_options = {
      "method": "post",
      "url": url,
      "headers": default_headers,
      "data": {
        "name": 'Demo app',
        "region": this.state.region_value,
        "description": 'Application description'
      }
    };

    // Options passed to API for polling its status
    var broadcast_polling_options = {
      "method": "get",
      "headers": default_headers
    };

    // Make the request and collect response
    var create_response = await axios(broadcast_create_options);
    console.log('Response Received');

    // Extract broadcast ID from response and set the current state to "Broadcast Created: <<BROADCAST_ID>>" 
    var broadcast_id = create_response.data.id;
    this.setState({ message: 'broadcast Created: ' + broadcast_id });

    // Update the URL for polling options.
    broadcast_polling_options["url"] = url + "/" + broadcast_id;

    /**
     * Alternative code for setInterval
     */
    // var success = false;
    // while (success === false) {
    //   var response = await axios(broadcast_polling_options);
    //   if (response.data.status === "ready") {
    //     this.setState({ message: "Stream is now ready" });
    //     this.setState({ broadcast_url: "URL: " + response.data.ingest.stream_url });
    //     this.setState({ broadcast_key: "Key: " + response.data.ingest.stream_key });
    //     success = true;
    //   } else {
    //     this.setState({ message: 'Polling' });
    //   }
    // }

    // To make the the polling appear active we will implement a counter based status.
    var counter = 0;

    var self = this;
    var poll_interval = setInterval(async function() {
      try {
        var response = await axios(broadcast_polling_options);
        if (response.data.status === "ready") {
          self.setState({ message: "Stream is now ready" });
          self.setState({ broadcast_url: "URL: " + response.data.ingest.url });
          self.setState({ broadcast_key: "Key: " + response.data.ingest.key });

          // We have what we need clear the interval.
          clearInterval(poll_interval);
        } else {
          // Polling will appear as: Polling. -> Polling.. -> Polling... -> Polling. -> Polling.. -> Polling... and so on until we get that the stream is ready
          self.setState({ message: 'Polling' + '.'.repeat(1 + counter%3) });
        }
        counter = counter + 1;
      } catch (error) { console.log(error) }
    }, 3000);

  }

  render() {
    /* Renders the component */
    return (
      <div className="App">
        <h1> Uiza Guide </h1>
        <header className="App-header">

          <div style={{ align: "left", float: 'left', width: "45%", margin: "10px", height: "220px", padding: '10px', border: "1px solid white" }}>
            <p> Start broadcast <br />
              <label>Pick your region: &nbsp;
              <select value={this.state.region_value} onChange={(event) => { this.setState({ region_value: event.target.value }); }}>
                  <option value="in-bangalore-1">in-bangalore-1</option>
                  <option value="in-mumbai-1">in-mumbai-1</option>
                </select>
              </label> &nbsp;
            <button onClick={this.start_broadcast}>Start broadcast</button> <br />
              {this.state.message}<br />
              {this.state.broadcast_url}<br />
              {this.state.broadcast_key}<br />
            </p>
          </div>
        </header>
      </div>
    )
  }
}

class App extends Component {
/**
 * This is the container that holds the entire application.
 * It contains pagination with two pages: 1. Broadcast Page, 2. Viewer Page
 */

  render() {
    return (
      <Router>
        <div className='page'>
         {/* It contains pagination with two pages: 1. Broadcast Page, 2. Viewer Page */}
          <nav>
            <ul>
              <li>
                <Link to="/broadcast">Broadcast Page</Link>
              </li>
              <li>
                <Link to="/viewer" onClick={ViewerPage.load_alive_streams}>Viewer Page</Link>
              </li>
            </ul>
          </nav>

          {/* A <Switch> looks through its children <Route>s and renders the first one that matches the current URL. */}
          <Switch>
            <Route path="/broadcast">
              <BroadcastPage />
            </Route>
            <Route path="/viewer">
              <ViewerPage />
            </Route>
            {/* Pay close attention to the ('*') in the end, it will help in matching entire video playback url alongwith any '/' in between
              * So the URL: domain.com/playback_url.ext will be parsed entirely.
              * without the star it will be split at the first '/' and appear as domain.com which is not playable as a URL.
              * What is videoid? Its the variable that the playback URL will be assigned to.
              * So In short videoid = domain.com/playback_url.ext (as an example)
              */}

            <Route path="/video/:videoid*">
              <VideoPage />
            </Route>
          </Switch>
        </div>
      </Router>
    )
  }
}

export default App;
