<?php
namespace App\Http\Controllers;
use App\Models\Scenario;
use Illuminate\Http\Request;
class ScenarioController extends Controller {
    public function index(){ return Scenario::latest()->paginate(25); }
    public function store(Request $request){
        $data=$request->validate(['name'=>'required|string|max:120','payload'=>'required|array']);
        $data['payload']['mode']='simulation-only';
        return response()->json(Scenario::create($data),201);
    }
    public function show(Scenario $scenario){ return $scenario; }
    public function destroy(Scenario $scenario){ $scenario->delete(); return response()->noContent(); }
}

