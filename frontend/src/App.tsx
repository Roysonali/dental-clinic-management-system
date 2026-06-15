import { useEffect } from "react";
import { api } from "./services/api";

function App() {
  useEffect(() => {
    api.get("/")
      .then((response) => {
        console.log(response.data);
      })
      .catch((error) => {
        console.error(error);
      });
  }, []);

  return (
    <div>
      <h1>DensCare Frontend Running</h1>
    </div>
  );
}

export default App;